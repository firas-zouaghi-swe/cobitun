# 1. Use a minimal Node.js 20 image based on Alpine Linux (very small)
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Accept build arguments for environment variables (will be set during docker build)
ARG JWT_SECRET=build-time-secret-for-next-build
ARG DATABASE_URL=file:/app/data/db.sqlite
ARG NODE_ENV=production

# 4. Set non-sensitive env for build (do NOT set NODE_ENV to production before installing devDeps)
ENV DATABASE_URL=${DATABASE_URL}

# 5. Copy package.json and package-lock.json first (speeds up rebuilds by caching dependencies)
COPY package*.json ./

# 6. Install all dependencies (include devDependencies so Tailwind/PostCSS plugins are available during build)
RUN npm install --include=dev

# 7. Copy the rest of your source code
COPY . .

# 8. Generate Prisma client (required before building Next.js)
RUN npm run prisma:generate || npx prisma generate

# 9. Build the Next.js production bundle (creates .next folder)
RUN npm run build

# 10. After successful build, set NODE_ENV to production for runtime
ENV NODE_ENV=production

# 11. Allow Render to connect through the runtime port variable if provided
ENV PORT=3000

# 12. Document that the container will listen on port 3000
EXPOSE 3000

# 11. Start the production server when the container runs
CMD ["npm", "start"]
