const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from dist after build
app.use(express.static('dist'));

async function executeMigrations(supabase) {
  const migrationsPath = path.join(__dirname, 'supabase', 'migrations');
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
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log(`Migration ${migrationFile} partially applied (some objects already exist)`);
        continue;
      }
      throw new Error(`Failed to execute migration ${migrationFile}: ${error.message}`);
    }
  }
}

async function executeConsolidatedSchema(supabase) {
  const schemaPath = path.join(__dirname, 'supabase', 'consolidated-schema.sql');
  
  try {
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await supabase.rpc('exec_sql', { sql: statement });
      } catch (error) {
        if (error.message?.includes('already exists')) {
          console.log('Object already exists, continuing...');
          continue;
        }
        throw error;
      }
    }
    
    console.log('Successfully executed consolidated schema');
  } catch (error) {
    throw new Error(`Failed to execute consolidated schema: ${error.message}`);
  }
}

async function createAdminUser(supabase) {
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
  } catch (error) {
    throw new Error(`Failed to create admin user: ${error.message}`);
  }
}

app.post('/api/setup', async (req, res) => {
  const setupToken = process.env.SETUP_TOKEN;
  const providedToken = req.headers['x-setup-token'];
  const useConsolidatedSchema = req.body.useConsolidatedSchema === true;

  if (!setupToken || providedToken !== setupToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
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

    res.json({ 
      success: true, 
      message: `Setup completed successfully. ${useConsolidatedSchema ? 'Consolidated schema' : 'Database migrations'} have been applied and admin user has been created.`,
      adminCredentials: {
        email: 'admin@admin.de',
        password: 'password'
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ 
      error: 'Setup failed', 
      details: error.message,
      help: 'Make sure you have the correct SUPABASE_SERVICE_KEY with sufficient permissions.'
    });
  }
});

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
