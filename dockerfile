FROM node:18
WORKDIR /app
# Copy package.json from src to the working directory
COPY src/package*.json ./
RUN npm install
# Copy the entire src directory to /app
COPY src/ .
EXPOSE 3000
CMD ["npm", "start"]