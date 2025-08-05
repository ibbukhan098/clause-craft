# Contract Generator App

A modern web application for generating and managing legal contracts with AI-powered analysis.

## Features

- Generate contracts from templates
- AI-powered contract analysis and risk assessment
- Interactive contract editor with clause management
- Responsive design with dark/light mode support

## Tech Stack

- **Vite** - Build tool and development server
- **TypeScript** - Type safety and enhanced developer experience
- **React** - Frontend framework for building user interfaces
- **shadcn-ui** - Beautiful and accessible UI components
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Supabase** - Backend services for database and edge functions

## Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local` if needed
   - Configure your Supabase credentials

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:8080`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality

## Deployment

The application can be deployed to any static hosting service that supports single-page applications.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
└── integrations/  # External service integrations
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.