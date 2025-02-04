# WLO-Bot - AI-Powered Educational Chatbot Platform

WLO-Bot is a comprehensive platform that enables educators to create, manage, and deploy AI-powered chatbots tailored for educational purposes. The platform integrates with WirLernenOnline (WLO) to provide access to high-quality educational resources and features an advanced learning progress tracking system.

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

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Supabase project with database access
- OpenAI API key or compatible LLM provider

### Initial Setup

1. Clone the repository:
   \`\`\`bash
   git clone [repository-url]
   cd wlo-bot
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Create a \`.env\` file with required environment variables:
   \`\`\`env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SETUP_TOKEN=your_secure_setup_token
   \`\`\`

4. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Access the setup page:
   \`\`\`
   http://localhost:5173/setup
   \`\`\`

   The setup page will:
   - Check if the database is empty
   - Verify database connections
   - Create the admin user
   - Set up required storage buckets
   - Provide admin credentials

   IMPORTANT: Save the admin credentials shown after successful setup!

### Configuration

1. After setup, log in with the admin credentials
2. Configure your LLM provider in the admin panel
3. Set up the WLO integration if required

### Development

The project structure follows a modular organization:

\`\`\`
src/
├── components/     # Reusable UI components
├── lib/           # Utilities and shared functions
├── pages/         # Page components
├── store/         # State management
└── types/         # TypeScript type definitions
\`\`\`

### Building

\`\`\`bash
npm run build
\`\`\`

The build output will be in the \`dist/\` directory.

## Deployment

The application is configured for deployment on Netlify. The \`vercel.json\` configuration handles API proxying and routing.

### Environment Variables

Required environment variables for production:
- \`VITE_SUPABASE_URL\`
- \`VITE_SUPABASE_ANON_KEY\`
- \`VITE_SETUP_TOKEN\` (for initial setup only)

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