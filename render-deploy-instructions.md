# Render Docker Deployment Instructions

These are the exact steps to deploy your app to Render using Docker.

## 1. Ensure your repo is ready
Make sure your project root contains:
- `Dockerfile`
- `.dockerignore`
- `render-env-entries.txt`
- `package.json`
- `next.config.ts`

If you do not already have a GitHub repo for this project, create one and push the current folder.

```powershell
git init
git add .
git commit -m "Prepare render deployment"
git branch -M main
# replace with your GitHub repo URL
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 2. Run a local Docker build to verify
From the project root:

```powershell
docker build -t cobitun-app .
```

If it completes successfully, run the container locally:

```powershell
docker run -p 3000:3000 cobitun-app
```

Then open `http://localhost:3000`.

## 3. Create the Render Web Service
1. Go to https://render.com and sign in with GitHub.
2. Click **New +** → **Web Service**.
3. Select your GitHub repo.
4. Choose:
   - Environment: `Docker`
   - Branch: `main`
   - Instance type: `Free`
5. Create the service.

## 4. Add a Persistent Disk
In the Web Service settings:
- Add Disk
- Mount Path: `/app/data`
- Size: `1 GB`

This is required to store the SQLite database.

## 5. Set environment variables
Open `render-env-entries.txt` and copy the Build and Runtime sections into Render.

### Build Environment
Use the first section in Render Build Environment.

### Runtime Environment
Use the second section in Render Environment.

**Important:** replace the placeholder secrets with your real values.

### Health check endpoint
After deployment, use `/api/health` as a Render health check or monitoring endpoint.
- The route reports missing required environment variables such as `JWT_SECRET`.
- If `JWT_SECRET` is not set, the endpoint returns `503` with `environment.status: down`.

## 6. Deploy and verify
- Wait for Render to finish building and start the service.
- Visit the `.onrender.com` URL from Render.
- If the app loads, deployment is successful.
- If there is a build or runtime error, check the Render logs.

## 7. Add your custom domain
1. In Render, go to the Web Service settings → Custom Domains.
2. Add `cyber-dbi.net` and `www.cyber-dbi.net`.
3. Update GoDaddy DNS using the records Render gives you.
4. Verify and enable HTTPS redirect.
