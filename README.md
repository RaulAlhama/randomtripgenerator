# Random Trip Generator - Configuration

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Auth0 Configuration

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new Application (Single Page Application)
3. Configure the following settings:
   - **Domain**: Your Auth0 tenant domain (e.g., `your-tenant.auth0.com`)
   - **Client ID**: Your application client ID
   - **Client Secret**: Your application client secret
   - **Audience**: Your API identifier (e.g., `https://randomtripgenerator-api`)
4. Set Allowed Callback URLs: `http://localhost:3000`
5. Set Allowed Logout URLs: `http://localhost:3000`
6. Enable "Refresh Token" grant type

### Create Auth0 API

1. Go to APIs in Auth0 Dashboard
2. Create a new API:
   - **Identifier (Audience)**: `https://randomtripgenerator-api`
   - **Signing Algorithm**: RS256
3. Note the API Identifier for your `.env` file

## Running Locally

```bash
npm install
npm start
```

Visit http://localhost:3000

## Deployment to Render

1. Push your code to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set environment variables:
   - `AUTH0_DOMAIN`: Your Auth0 domain
   - `AUTH0_AUDIENCE`: Your API identifier
5. Build Command: `npm install`
6. Start Command: `node server.js`

## Domain Configuration

After deploying to Render:
1. Add your custom domain in Render dashboard
2. Update Auth0 Allowed Callback/Logout URLs with your domain
3. Update `.env` for production if needed
