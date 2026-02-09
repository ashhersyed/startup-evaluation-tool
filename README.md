# Startup Evaluation Tool

A web application for evaluating startups using a VC-backed framework. Users submit their email to access a scoring tool that evaluates startups across 6 key criteria.

## Features

- **Email Capture**: Collect emails via Beehiiv newsletter integration
- **Startup Scoring**: Evaluate startups across 6 weighted criteria
- **Real-time Calculation**: Instant weighted score calculation
- **Share Results**: Share evaluation results with a single click
- **Export CSV**: Download evaluation reports

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **Package Manager**: pnpm
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm run dev
```

The app will be available at `http://localhost:3000`

### Build

```bash
pnpm run build
```

## Project Structure

```
client/
  src/
    pages/
      Home.tsx        # Landing page with email capture
      Scorer.tsx      # Evaluation scoring interface
    components/
      EmailGate.tsx   # Email subscription component
      ui/             # Reusable UI components
    lib/
      utils.ts        # Utility functions
    App.tsx          # Main app component
    main.tsx         # Entry point
    index.css        # Global styles
  index.html         # HTML entry point

tailwind.config.js   # Tailwind CSS configuration
vite.config.ts       # Vite configuration
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://your-api-url.com
```

## Deployment

The project is configured for deployment on Vercel. Push to GitHub and connect your repository to Vercel for automatic deployments.

## License

MIT
