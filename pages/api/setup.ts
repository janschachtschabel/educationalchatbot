import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

async function executeMigrations(supabase: any) {
  const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Ensures migrations run in order

  for (const migrationFile of migrationFiles) {
    const sqlContent = fs.readFileSync(
      path.join(migrationsPath, migrationFile),
      'utf8'
    );

    try {
      // Split SQL content into individual statements
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await supabase.rpc('exec_sql', { sql: statement });
      }
      
      console.log(`Successfully executed migration: ${migrationFile}`);
    } catch (error: any) {
      // If the error indicates the object already exists, we can continue
      if (error.message?.includes('already exists')) {
        console.log(`Migration ${migrationFile} partially applied (some objects already exist)`);
        continue;
      }
      throw new Error(`Failed to execute migration ${migrationFile}: ${error.message}`);
    }
  }
}

async function executeConsolidatedSchema(supabase: any) {
  const schemaPath = path.join(process.cwd(), 'supabase', 'consolidated-schema.sql');
  
  try {
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL content into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await supabase.rpc('exec_sql', { sql: statement });
      } catch (error: any) {
        // If the error indicates the object already exists, we can continue
        if (error.message?.includes('already exists')) {
          console.log('Object already exists, continuing...');
          continue;
        }
        throw error;
      }
    }
    
    console.log('Successfully executed consolidated schema');
  } catch (error: any) {
    throw new Error(`Failed to execute consolidated schema: ${error.message}`);
  }
}

async function createAdminUser(supabase: any) {
  const adminEmail = 'admin@admin.de';
  const adminPassword = 'password';

  try {
    // Check if admin user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (existingUser) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: { role: 'admin' }
    });

    if (authError) throw authError;

    // Insert admin role in custom roles table if you have one
    await supabase
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: 'admin',
        created_at: new Date().toISOString()
      });

    console.log('Admin user created successfully');
  } catch (error: any) {
    throw new Error(`Failed to create admin user: ${error.message}`);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const setupToken = process.env.SETUP_TOKEN;
  const providedToken = req.headers['x-setup-token'];
  const useConsolidatedSchema = req.body.useConsolidatedSchema === true;

  if (!setupToken || providedToken !== setupToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Test database connection
    const { data: testData, error: testError } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1)
      .catch(() => ({ data: null, error: null }));

    // Execute either consolidated schema or migrations
    if (useConsolidatedSchema) {
      await executeConsolidatedSchema(supabase);
    } else {
      await executeMigrations(supabase);
    }

    // Create admin user
    await createAdminUser(supabase);

    // Verify critical tables exist
    const verificationChecks = [
      supabase.from('conversations').select('count').limit(1),
      supabase.from('messages').select('count').limit(1),
      // Add more verification checks as needed
    ];

    await Promise.all(verificationChecks);

    return res.status(200).json({ 
      success: true, 
      message: `Setup completed successfully. ${useConsolidatedSchema ? 'Consolidated schema' : 'Database migrations'} have been applied and admin user has been created.`,
      adminCredentials: {
        email: 'admin@admin.de',
        password: 'password'
      }
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return res.status(500).json({ 
      error: 'Setup failed', 
      details: error.message,
      help: 'Make sure you have the correct SUPABASE_SERVICE_KEY with sufficient permissions.'
    });
  }
}
