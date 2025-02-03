const { createClient } = require('@supabase/supabase-js');

async function executeMigrations(supabase) {
  // Da wir in der Serverless-Umgebung keinen direkten Dateizugriff haben,
  // müssen wir die SQL-Statements direkt hier definieren
  const migrations = [
    `
    CREATE EXTENSION IF NOT EXISTS "vector";
    
    CREATE TABLE IF NOT EXISTS "conversations" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        title TEXT,
        user_id UUID REFERENCES auth.users(id)
    );

    CREATE TABLE IF NOT EXISTS "messages" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "user_roles" (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `,
    `
    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
    `,
    `
    CREATE POLICY "Users can view own conversations"
        ON conversations FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own conversations"
        ON conversations FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    `,
    `
    CREATE POLICY "Users can view messages in their conversations"
        ON messages FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        ));

    CREATE POLICY "Users can insert messages in their conversations"
        ON messages FOR INSERT
        WITH CHECK (EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        ));
    `,
    `
    CREATE POLICY "Admin users can manage roles"
        ON user_roles FOR ALL
        USING (EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        ));

    CREATE POLICY "Users can view own role"
        ON user_roles FOR SELECT
        USING (auth.uid() = user_id);
    `
  ];

  for (const migration of migrations) {
    try {
      const statements = migration
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
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
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

exports.handler = async function(event, context) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-setup-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Nur POST-Anfragen erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const setupToken = process.env.SETUP_TOKEN;
  const providedToken = event.headers['x-setup-token'];

  if (!setupToken || providedToken !== setupToken) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
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

    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`);
    }

    // Execute migrations
    await executeMigrations(supabase);

    // Create admin user
    await createAdminUser(supabase);

    // Verify critical tables exist
    const verificationChecks = [
      supabase.from('conversations').select('count').limit(1),
      supabase.from('messages').select('count').limit(1),
    ];

    await Promise.all(verificationChecks);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Setup completed successfully. Database schema has been created and admin user has been set up.',
        adminCredentials: {
          email: 'admin@admin.de',
          password: 'password'
        }
      })
    };
  } catch (error) {
    console.error('Setup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Setup failed',
        details: error.message,
        help: 'Make sure you have the correct SUPABASE_SERVICE_KEY with sufficient permissions.'
      })
    };
  }
};
