FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Inlined into the client bundle at build time. Server secrets stay runtime env.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_AUTH_GOOGLE_ID
ARG NEXT_PUBLIC_AUTH_FACEBOOK_ID
ARG NEXT_PUBLIC_AUTH_APPLE_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_AUTH_GOOGLE_ID=$NEXT_PUBLIC_AUTH_GOOGLE_ID
ENV NEXT_PUBLIC_AUTH_FACEBOOK_ID=$NEXT_PUBLIC_AUTH_FACEBOOK_ID
ENV NEXT_PUBLIC_AUTH_APPLE_ID=$NEXT_PUBLIC_AUTH_APPLE_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
