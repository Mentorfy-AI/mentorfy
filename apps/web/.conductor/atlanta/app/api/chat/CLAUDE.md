# CLAUDE.md - Chat API Directory

This directory contains the core chat functionality APIs that power the AI mentor interactions in the Mentorfy platform.

## Files Overview

### route.ts - Main Chat Processing Endpoint
**Route**: `/api/chat`
**Method**: `POST`
**Purpose**: Processes user messages through the complete AI pipeline

#### Request/Response Interfaces

```typescript
interface ChatRequest {
  message: string                    // User's input message
  conversationId?: string           // Optional existing conversation
  behaviorSettings?: BehaviorSettings // AI behavior configuration
}

interface ChatResponse {
  response: string                  // AI-generated response
  conversationId?: string          // Conversation identifier
  sources?: string[]               // Knowledge graph sources
  error?: string                   // Error message if applicable
}
```

#### Processing Pipeline

**1. Authentication and Context Setup (Lines 55-89)**
```typescript
// Validate Supabase user session
const { data: { user }, error: userError } = await supabase.auth.getUser()

// Get user's organization context
const { data: userOrg } = await supabase
  .from('user_organization')
  .select('organization_id')
  .eq('user_id', user.id)
  .single()

// Find default mentor bot for organization
const { data: mentorBot } = await supabase
  .from('mentor_bot')
  .select('id')
  .eq('organization_id', userOrg.organization_id)
  .limit(1)
  .single()
```

**2. Conversation Management (Lines 92-113)**
```typescript
let conversationId = body.conversationId
if (!conversationId) {
  // Create new conversation with auto-generated title
  const { data: newConversation } = await supabase
    .from('conversation')
    .insert({
      user_id: user.id,
      mentor_bot_id: mentorBot.id,
      title: `New Conversation ${new Date().toLocaleDateString()}`
    })
    .select('id')
    .single()
  
  conversationId = newConversation.id
}
```

**3. User Message Storage (Lines 115-128)**
- Stores user message in database immediately
- Continues processing even if storage fails
- Maintains conversation history integrity

**4. Knowledge Graph Search (Lines 148-164)**
```typescript
try {
  searchResults = await searchKnowledgeGraph(body.message, 5)
  contextString = searchResults
    .map(result => result.fact)
    .join('\n\n')
} catch (searchError) {
  // Continue without context rather than failing completely
  contextString = ''
}
```

**5. AI Response Generation (Lines 166-181)**
```typescript
const systemPrompt = buildSystemPrompt(behaviorSettings, contextString)
const modelParams = getModelParameters(behaviorSettings)

const completion = await getOpenAIClient().chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: body.message }
  ],
  temperature: modelParams.temperature,
  max_tokens: modelParams.maxTokens,
})
```

**6. Response Storage and Cleanup (Lines 184-208)**
- Stores AI response with source citations
- Updates conversation timestamp
- Returns formatted response

#### Key Features

**Graceful Degradation**:
- Knowledge graph search failures don't break chat
- Message storage failures don't prevent responses
- External service errors are handled gracefully

**Behavior Configuration**:
- Default behavior settings provide fallback values
- Character limit validation prevents prompt engineering issues
- Model parameters dynamically adjust based on user preferences

**Source Attribution**:
- Knowledge graph results are cited in responses
- Source summaries provided for transparency
- Enables fact-checking and knowledge verification

#### Error Handling Strategy

**Authentication Errors (Lines 55-75)**:
- Missing or invalid user session returns 401
- Organization membership validation
- Mentor bot availability checking

**Validation Errors (Lines 44-49)**:
- Message content validation
- Behavior settings character limits
- Input sanitization

**Service Integration Errors**:
- OpenAI API failures with detailed error messages
- Knowledge graph search timeout handling
- Database operation error recovery

## search/ Subdirectory

### route.ts - Knowledge Graph Search Debug Endpoint
**Route**: `/api/chat/search`
**Methods**: `GET`, `POST`
**Purpose**: Direct access to knowledge graph search for debugging and testing

#### GET Method Features

**Health Check Support**:
```typescript
// Health check: /api/chat/search?health=true
if (healthCheck) {
  const health = await checkGraphitiHealth()
  return NextResponse.json({ health })
}
```

**Query Testing**:
```typescript
// Search query: /api/chat/search?query=search_term&limit=10
const query = searchParams.get('query')
const limit = limitParam ? parseInt(limitParam, 10) : 5
```

**Parameter Validation**:
- Query parameter required
- Limit between 1-20 (default 5)
- Input sanitization and type checking

#### POST Method Features

**Request Body Structure**:
```typescript
{
  query: string,    // Search query string
  limit?: number    // Result limit (1-20, default 5)
}
```

**Response Format**:
```typescript
interface SearchResponse {
  results?: Array<{
    fact: string
    confidence?: number
    source?: string
  }>
  query?: string
  count?: number
  health?: boolean
  error?: string
}
```

#### Use Cases

**Development and Testing**:
- Validate knowledge graph connectivity
- Test search query effectiveness
- Debug search result quality
- Monitor service health

**Administrative Tools**:
- Search result analysis
- Knowledge base content verification
- System monitoring and diagnostics
- Performance testing

## Integration Architecture

### Knowledge Graph Integration
- Uses `searchKnowledgeGraph()` from `@/lib/graphiti-client`
- Searches FastAPI backend for relevant facts
- Integrates results into AI system prompts
- Provides source attribution for responses

### Database Integration
- Supabase for user authentication and conversation storage
- Real-time conversation history maintenance
- Message metadata storage including sources
- Organization-scoped data access

### AI Model Integration
- OpenAI GPT-4o-mini for response generation
- Dynamic prompt construction based on behavior settings
- Context injection from knowledge graph search
- Parameter tuning based on user preferences

## Performance Considerations

### Response Time Optimization
- Parallel processing where possible
- Graceful degradation to maintain responsiveness
- Cached OpenAI client initialization
- Efficient database queries

### Scalability Patterns
- Stateless request handling
- Database connection pooling
- External service timeout handling
- Error recovery and retry logic

### Resource Management
- Token usage optimization for OpenAI
- Database connection lifecycle management
- Memory efficient message storage
- Concurrent request handling

## Security and Privacy

### Data Protection
- User messages encrypted in transit and at rest
- Organization-scoped data isolation
- No sensitive data in API responses
- Secure external service integration

### Input Validation
- Message content sanitization
- Behavior settings validation
- Search query parameter validation
- SQL injection prevention

### Access Control
- Authentication required for all endpoints
- Organization membership validation
- Role-based access (future enhancement)
- Audit trail capabilities (planned)

This chat API directory provides the core intelligence layer for the Mentorfy platform, enabling AI-powered conversations with knowledge graph integration and comprehensive conversation management.