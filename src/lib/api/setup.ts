import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function executeMigrations(supabase: any) {
  const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sqlContent = fs.readFileSync(
      path.join(migrationsPath, migrationFile),
      'utf8'
    );

    try {
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await supabase.rpc('exec_sql', { sql: statement });
      }
      
      console.log(`Successfully executed migration: ${migrationFile}`);
    } catch (error: any) {
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
    
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await supabase.rpc('exec_sql', { sql: statement });
      } catch (error: any) {
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
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (existingUser) {
      console.log('Admin user already exists');
      return;
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });

    if (authError) throw authError;

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

export async function handleSetup(request: Request) {
  const setupToken = process.env.SETUP_TOKEN;
  const providedToken = request.headers.get('x-setup-token');
  const useConsolidatedSchema = await request.json().then(body => body.useConsolidatedSchema === true);

  if (!setupToken || providedToken !== setupToken) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
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
    ];

    await Promise.all(verificationChecks);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Setup completed successfully. ${useConsolidatedSchema ? 'Consolidated schema' : 'Database migrations'} have been applied and admin user has been created.`,
        adminCredentials: {
          email: 'admin@admin.de',
          password: 'password'
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Setup error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Setup failed', 
        details: error.message,
        help: 'Make sure you have the correct SUPABASE_SERVICE_KEY with sufficient permissions.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
