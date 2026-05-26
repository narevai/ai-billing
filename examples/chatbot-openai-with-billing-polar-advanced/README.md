<a href="https://narev.ai/guides">
  <img alt="Chatbot with Billing" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chatbot with AI Billing in Polar (OpenAI)</h1>
</a>

<p align="center">
    This is an open-source template built with Next.js, the AI SDK, and the <strong>ai-billing</strong> package. It helps you quickly build powerful chatbot applications with built-in monetization and billing capabilities, powered directly by OpenAI.
</p>

<p align="center">
  <a href="https://narev.ai/docs"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- **[ai-billing](https://narev.ai/docs/sdk/ai-billing)**
  - Seamless monetization and billing integration for your AI applications
  - Powered by [narev.ai](https://narev.ai)
- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://ai-sdk.dev/docs/introduction)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Powered directly by [OpenAI](https://platform.openai.com) via `@ai-sdk/openai`
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template uses [OpenAI](https://platform.openai.com) as the LLM provider via `@ai-sdk/openai`. Models are configured in `lib/ai/models.ts`. Included models: GPT 5, GPT 4o, GPT 4.1 Mini, o3 Mini, and o4 Mini.

### OpenAI Authentication

You need to provide an OpenAI API key by setting the `OPENAI_API_KEY` environment variable in your `.env.local` file.

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to other LLM providers like [Anthropic](https://anthropic.com), [Google](https://ai.google.dev), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of Chatbot with billing to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-openai-with-billing-polar&env=AUTH_SECRET,OPENAI_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER,NAREV_API_KEY&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D)

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm db:migrate # Setup database or apply latest database changes
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).
