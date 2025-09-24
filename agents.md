# SkillSphere Backend - Agent Development Guide

## Project Overview

**SkillSphere Backend** is a TypeScript-based REST API built with Hono framework and Bun runtime, designed to manage educational content including topics and lessons. The application integrates with Firebase Firestore for data persistence and Google's Gemini AI for content generation.

### Core Purpose
- Manage educational topics and lessons
- Generate AI-powered lesson content using Google Gemini
- Provide RESTful API endpoints for frontend applications
- Handle user authentication (currently disabled but infrastructure exists)

## Technology Stack

### Runtime & Framework
- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript with strict mode enabled

### Dependencies
- **Database**: Firebase Firestore (`@google-cloud/firestore`, `firebase-admin`)
- **AI Integration**: Google Gemini AI (`@google/generative-ai`, `@ai-sdk/google`, `ai`)
- **Development**: `@types/bun` for TypeScript support

### Infrastructure
- **Containerization**: Docker support with official Bun image
- **Port**: 3000 (configurable via PORT environment variable)
- **Authentication**: Firebase Admin SDK (currently commented out)

## Project Structure

```
skillsphere-backend/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── services/
│   │   └── firebase.ts       # Firebase configuration and exports
│   ├── routes/
│   │   ├── topics.ts         # Topic management endpoints
│   │   ├── lessons.ts        # Lesson retrieval endpoints
│   │   └── generateLessons.ts # AI-powered lesson generation
│   ├── middleware/           # (Empty - for future middleware)
│   └── utils/               # (Empty - for utility functions)
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── Dockerfile              # Container configuration
├── .env                    # Environment variables (gitignored)
└── .gitignore             # Git ignore rules
```

## API Endpoints

### Topics Management (`/topics`)
- **GET /topics** - Retrieve all topics from Firestore
- **POST /topics** - Create a new topic (admin functionality)

### Lessons Management (`/lessons`)
- **GET /lessons/:topicId** - Retrieve lessons for a specific topic
  - Uses hardcoded mappings: `Finance` → `qz86ZeGsFumWUaZg00TU`, `Politics` → `EVPXG2Qn5OJmtD3fOYDb`
  - Filters lessons by `topicId` field in Firestore

### AI Content Generation (`/generate-lessons`)
- **POST /generate-lessons** - Generate lessons using Google Gemini AI
  - Accepts array of topic names in request body
  - Generates 5 beginner lessons per topic
  - Automatically creates topic documents if they don't exist
  - Stores generated lessons in Firestore with topic references

## Environment Configuration

Required environment variables (create `.env` file):

```bash
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...} # JSON string

# Google AI Configuration  
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
PORT=3000  # Default port if not specified
```

## Development Guidelines

### Getting Started

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Environment Setup**
   - Create `.env` file with required variables
   - Ensure Firebase service account has Firestore permissions
   - Obtain Gemini API key from Google AI Studio

3. **Run Development Server**
   ```bash
   bun run dev
   ```
   - Server runs on `http://localhost:3000`
   - Hot reload enabled for development

### Code Standards

#### TypeScript Configuration
- Strict mode enabled
- JSX support configured for Hono
- Use proper typing for all functions and variables

#### File Organization
- **Routes**: Place all endpoint handlers in `src/routes/`
- **Services**: External service integrations in `src/services/`
- **Middleware**: Authentication and validation logic in `src/middleware/`
- **Utils**: Helper functions and utilities in `src/utils/`

#### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for types and interfaces
- Use kebab-case for file names
- Use descriptive names for API endpoints

### Database Schema

#### Topics Collection
```typescript
interface Topic {
  id: string;        // Auto-generated document ID
  name: string;      // Topic name (e.g., "Finance", "Politics")
  // Additional fields as needed
}
```

#### Lessons Collection
```typescript
interface Lesson {
  id: string;                    // Auto-generated document ID
  topicId: string;              // Reference to topic document
  title: string;                // Lesson title
  xp: number;                   // Experience points
  estimatedMinutes: number;     // Estimated completion time
  difficulty: "beginner";       // Difficulty level
  tags: string[];              // Topic tags
  content: MicroCard[];        // Array of lesson content
  createdAt: Date;             // Creation timestamp
}

interface MicroCard {
  type: "scenario" | "info" | "decision" | "quiz";
  text: string;  // Max 280 characters
  // Additional fields based on type
}
```

## Implementation Guidelines for Agents

### Adding New Features

#### 1. New API Endpoints
- Create new route files in `src/routes/`
- Follow existing pattern: export Hono instance
- Register routes in `src/index.ts`
- Add proper error handling and validation

Example:
```typescript
// src/routes/newFeature.ts
import { Hono } from "hono";
import { db } from "../services/firebase";

const newFeatureRoutes = new Hono();

newFeatureRoutes.get("/", async (c) => {
  // Implementation
  return c.json({ data: "response" });
});

export default newFeatureRoutes;
```

#### 2. Database Operations
- Use Firebase Admin SDK through `src/services/firebase.ts`
- Always handle async operations properly
- Add proper error handling for Firestore operations
- Consider data validation before database writes

#### 3. AI Integration
- Use existing Google Gemini setup in `generateLessons.ts` as reference
- Configure temperature and other parameters appropriately
- Handle JSON parsing errors from AI responses
- Validate AI-generated content before storing

### Authentication Implementation

The authentication middleware is currently commented out but can be enabled:

```typescript
// Uncomment in src/index.ts
app.use("*", async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth) return c.json({ error: "unauthorized" }, 401);
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    c.set("user", decoded);
    await next();
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }
});
```

### Error Handling Best Practices

1. **Validation Errors**: Return 400 with descriptive messages
2. **Authentication Errors**: Return 401 for unauthorized access
3. **Not Found**: Return 404 for missing resources
4. **Server Errors**: Return 500 with generic messages (log details)
5. **Database Errors**: Handle Firestore exceptions gracefully

### Testing Guidelines

1. **Unit Tests**: Test individual functions and utilities
2. **Integration Tests**: Test API endpoints with real database
3. **AI Tests**: Mock AI responses for consistent testing
4. **Environment Tests**: Test with different environment configurations

### Deployment

#### Docker Deployment
```bash
# Build image
docker build -t skillsphere-backend .

# Run container
docker run -p 3000:3000 --env-file .env skillsphere-backend
```

#### Environment-Specific Configurations
- **Development**: Use `.env` file with development credentials
- **Production**: Use environment variables or secure secret management
- **Testing**: Use separate Firebase project and API keys

## Security Considerations

### API Security
- Enable authentication middleware for production
- Validate all input data
- Use HTTPS in production
- Implement rate limiting for AI endpoints

### Environment Security
- Never commit `.env` files or service account keys
- Use secure secret management in production
- Rotate API keys regularly
- Limit Firebase service account permissions

### Data Security
- Validate data before Firestore operations
- Sanitize user inputs
- Implement proper access controls
- Log security events

## Performance Optimization

### Database Optimization
- Use Firestore indexes for complex queries
- Implement pagination for large datasets
- Cache frequently accessed data
- Optimize query patterns

### AI Integration Optimization
- Implement request caching for similar prompts
- Use appropriate temperature settings
- Handle rate limits gracefully
- Consider batch processing for multiple requests

## Monitoring and Logging

### Recommended Logging
- API request/response logging
- Database operation logging
- AI generation request logging
- Error and exception logging
- Performance metrics

### Health Checks
- Database connectivity
- AI service availability
- Environment variable validation
- Memory and CPU usage

## Future Enhancements

### Planned Features
1. **User Management**: Complete authentication system
2. **Progress Tracking**: User lesson completion tracking
3. **Advanced AI**: More sophisticated content generation
4. **Analytics**: Usage and performance analytics
5. **Caching**: Redis integration for performance
6. **Testing**: Comprehensive test suite

### Scalability Considerations
- Implement horizontal scaling strategies
- Consider microservices architecture
- Add load balancing capabilities
- Implement database sharding if needed

## Troubleshooting

### Common Issues

1. **Firebase Connection Issues**
   - Verify service account key format
   - Check Firestore permissions
   - Validate project configuration

2. **AI Generation Failures**
   - Verify Gemini API key
   - Check API quotas and limits
   - Validate prompt formatting

3. **Build/Runtime Issues**
   - Ensure Bun is properly installed
   - Check TypeScript configuration
   - Verify all dependencies are installed

### Debug Commands
```bash
# Check Bun version
bun --version

# Validate TypeScript
bun run tsc --noEmit

# Check dependencies
bun install --dry-run

# Test Firebase connection
# (Add custom health check endpoint)
```

## Contributing Guidelines

### Code Review Checklist
- [ ] TypeScript strict mode compliance
- [ ] Proper error handling
- [ ] Input validation
- [ ] Security considerations
- [ ] Performance implications
- [ ] Documentation updates
- [ ] Test coverage

### Pull Request Process
1. Create feature branch from main
2. Implement changes following guidelines
3. Add/update tests as needed
4. Update documentation
5. Submit pull request with detailed description
6. Address review feedback
7. Merge after approval

---

This guide should serve as a comprehensive reference for any developer or AI agent working on the SkillSphere Backend project. Keep this document updated as the project evolves and new features are added.
