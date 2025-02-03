# EduBot - AI-Powered Educational Chatbot Platform

EduBot is a comprehensive platform that enables educators to create, manage, and deploy AI-powered chatbots tailored for educational purposes. The platform integrates with WirLernenOnline (WLO) to provide access to high-quality educational resources and features an advanced learning progress tracking system.

## Features

### For Teachers
- **Custom Chatbot Creation**: Create personalized AI assistants with specific knowledge domains and teaching styles
- **Document Integration**: Upload and process teaching materials that the chatbot can reference
- **WLO Integration**: Search and integrate educational resources from WirLernenOnline
- **Conversation Starters**: Define initial questions or topics to guide students
- **Learning Progress Tracking**: Monitor student understanding and engagement
- **Access Management**: Control chatbot visibility and access through passwords

### For Students
- **Interactive Learning**: Engage with AI tutors tailored to specific subjects
- **Resource Access**: Get recommended educational materials from WLO
- **Progress Tracking**: Monitor learning progress across different topics
- **Flexible Access**: Use access codes or browse the public gallery

### Technical Features
- **Real-time Processing**: Immediate document processing and embedding generation
- **Adaptive Learning**: AI adjusts to student understanding levels
- **Multi-language Support**: Available in German and English
- **Responsive Design**: Works on all devices
- **Secure Authentication**: Role-based access control

## Technology Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Vector Search**: pgvector for document embeddings
- **Deployment**: Netlify

## Deployment & Setup

### Deployment Steps

1. Fork and clone the repository
2. Deploy to Vercel or Netlify
3. Set up the following environment variables in your deployment platform:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   SETUP_TOKEN=your_secure_setup_token
   ```
   Make sure to keep your `SUPABASE_SERVICE_KEY` and `SETUP_TOKEN` secure and never expose them publicly.

### Initial Setup

After deployment, you need to initialize the database and verify the setup:

1. Visit `your-deployed-url.com/setup` in your browser
2. Enter the `SETUP_TOKEN` you configured in your environment variables
3. Choose your database initialization method:
   - **Using Migrations** (default): Applies all migration files in sequence, good for development and tracking changes
   - **Using Consolidated Schema**: Applies a single schema file, simpler for fresh installations
4. The setup process will:
   - Verify database connection
   - Initialize required tables (using your chosen method)
   - Create an admin user
   - Confirm all systems are operational

For fresh installations, you can use the consolidated schema by sending a POST request to `/api/setup` with:
```json
{
  "useConsolidatedSchema": true
}
```

After successful setup, you will receive the admin login credentials:
```
Email: admin@admin.de
Password: password
```

⚠️ **Important Security Steps After Setup**:
1. **Remove SETUP_TOKEN**: Immediately remove the `SETUP_TOKEN` from your environment variables after successful setup
2. **Change Admin Password**: Log in as admin and change the default password
3. **Secure Your Instance**: Make sure to properly configure authentication and access controls

### First Login & Security

1. Navigate to `your-deployed-url.com/login`
2. Log in with the admin credentials:
   - Email: admin@admin.de
   - Password: password
3. Immediately after first login:
   - Go to your profile settings
   - Change the default password to a secure one
   - Configure additional security settings as needed

### Development Setup

For local development:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

3. Create a `.env` file with the required variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   SETUP_TOKEN=your_secure_setup_token
   ```

4. Start the development server with Netlify Functions:
   ```bash
   netlify dev
   ```

This will start both the Vite dev server and the Netlify Functions locally.

## Development

### Project Structure

```
src/
├── components/     # Reusable UI components
├── lib/           # Utilities and shared functions
├── pages/         # Page components
├── store/         # State management
└── types/         # TypeScript type definitions
```

### Key Components

- `ChatInterface`: Main chat interaction component
- `DocumentUpload`: Document processing and embedding
- `LearningProgressTracker`: Student progress monitoring
- `WLOResourceList`: WLO material integration

### Building

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [WirLernenOnline](https://wirlernenonline.de/) for educational resources
- [Supabase](https://supabase.com/) for backend infrastructure
- [OpenAI](https://openai.com/) for LLM capabilities
- [Lucide](https://lucide.dev/) for icons