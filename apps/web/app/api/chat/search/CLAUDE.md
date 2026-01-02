# CLAUDE.md - Chat Search API Endpoint

This directory contains the knowledge graph search debug endpoint for testing and monitoring Graphiti integration.

## File Overview

### route.ts - Knowledge Graph Search Debug Endpoint
**Route**: `/api/chat/search`
**Methods**: `GET`, `POST`
**Purpose**: Direct access to Graphiti knowledge graph search for debugging, testing, and monitoring

#### Core Functionality

**Debug Interface**:
- Direct access to knowledge graph search without chat context
- Parameter validation and error handling
- Query echo and result counting for testing
- Health check capabilities for monitoring

**Development Tools**:
- Test search queries and validate results
- Monitor knowledge graph connectivity
- Debug search result quality and relevance
- Performance testing for search operations

#### GET Method Implementation

**Health Check Feature** (Lines 24-27):
```typescript
if (healthCheck) {
  const health = await checkGraphitiHealth()
  return NextResponse.json({ health })
}
```
- **Endpoint**: `GET /api/chat/search?health=true`
- **Purpose**: Monitor Graphiti service availability
- **Response**: `{ health: boolean }`
- **Use Case**: System monitoring and uptime checking

**Search Query Interface** (Lines 29-44):
```typescript
const query = searchParams.get('query')
const limitParam = searchParams.get('limit')
const limit = limitParam ? parseInt(limitParam, 10) : 5

if (!query) {
  return NextResponse.json(
    { error: 'Query parameter is required' },
    { status: 400 }
  )
}
```

**Parameter Validation**:
- **query**: Required string parameter for search terms
- **limit**: Optional integer between 1-20 (default: 5)
- **health**: Boolean flag for health check mode

**URL Examples**:
- `GET /api/chat/search?query=artificial intelligence&limit=10`
- `GET /api/chat/search?health=true`
- `GET /api/chat/search?query=machine learning`

#### POST Method Implementation

**Request Body Handling** (Lines 69-87):
```typescript
const body = await request.json()
const { query, limit = 5 } = body

if (!query || typeof query !== 'string') {
  return NextResponse.json(
    { error: 'Query is required and must be a string' },
    { status: 400 }
  )
}
```

**Type Safety**:
- Validates query as non-empty string
- Ensures limit is number within valid range
- Provides detailed error messages for validation failures

**Request Format**:
```typescript
{
  query: "search terms here",
  limit?: 10  // Optional, defaults to 5
}
```

#### Response Format

**Successful Search Response**:
```typescript
interface SearchResponse {
  results: Array<{
    fact: string
    confidence?: number
    source?: string
  }>
  query: string
  count: number
}
```

**Health Check Response**:
```typescript
{
  health: boolean
}
```

**Error Response**:
```typescript
{
  error: string
}
```

#### Key Features

**Input Validation**:
- Required query parameter checking
- Limit range validation (1-20)
- Type safety for all parameters
- Sanitization of search inputs

**Search Integration**:
- Uses `searchKnowledgeGraph()` from `@/lib/graphiti-client`
- Passes through search results without modification
- Maintains search result metadata (confidence, source)
- Preserves original search context

**Debugging Support**:
- Query echo in response for verification
- Result count for quick assessment
- Detailed error messages for troubleshooting
- Consistent logging for monitoring

#### Error Handling

**Validation Errors (400)**:
- Missing query parameter
- Invalid limit values
- Malformed request body
- Type validation failures

**Service Errors (500)**:
- Graphiti service unavailable
- Network connectivity issues
- Search processing failures
- Unexpected system errors

**Error Response Strategy**:
```typescript
return NextResponse.json(
  { error: error instanceof Error ? error.message : 'Search failed' },
  { status: 500 }
)
```

## Use Cases and Applications

### Development and Testing
- **Query Testing**: Validate search terms before implementing in chat
- **Result Analysis**: Examine search quality and relevance
- **Performance Testing**: Measure search response times
- **Parameter Tuning**: Test different limit values for optimal results

### System Monitoring
- **Health Checks**: Automated monitoring of Graphiti service
- **Connectivity Testing**: Validate backend service integration
- **Performance Monitoring**: Track search response times
- **Error Rate Monitoring**: Monitor search failure rates

### Administrative Tools
- **Content Verification**: Verify knowledge base search results
- **Search Quality Assessment**: Evaluate search result relevance
- **Debugging Support**: Investigate search-related issues
- **Integration Testing**: Validate backend service changes

### API Development
- **Frontend Development**: Test search functionality during UI development
- **Integration Testing**: Validate search API integration
- **Documentation**: Provide examples for API documentation
- **Demonstration**: Show search capabilities to stakeholders

## Integration with Main Chat API

### Shared Service Layer
- Both endpoints use `searchKnowledgeGraph()` from `@/lib/graphiti-client`
- Consistent error handling patterns
- Same backend service integration
- Identical search result format

### Debugging Workflow
1. **Issue Detection**: User reports chat quality issues
2. **Search Testing**: Use debug endpoint to test specific queries
3. **Result Analysis**: Examine search results for relevance
4. **Chat Testing**: Validate fixes in actual chat context

### Development Workflow
1. **Search Development**: Test search queries in isolation
2. **Result Validation**: Verify search quality before chat integration
3. **Performance Testing**: Ensure search meets response time requirements
4. **Chat Integration**: Integrate validated search into chat pipeline

## Security Considerations

### Access Control
- No authentication required (debug endpoint)
- Consider adding admin-only access in production
- Rate limiting recommended for abuse prevention
- Input sanitization for security

### Data Exposure
- Search results may contain sensitive information
- No user context or personalization
- Consider adding access controls for sensitive deployments
- Audit logging for search queries

### Input Security
- Query parameter sanitization
- SQL injection prevention
- XSS prevention in responses
- Input length limiting

## Performance Optimization

### Response Time
- Direct passthrough to search service
- Minimal processing overhead
- Efficient parameter validation
- Fast error response paths

### Resource Usage
- No database operations
- Minimal memory footprint
- Stateless request handling
- Efficient JSON parsing

### Scalability
- Horizontal scaling support
- No session state management
- Independent of user authentication
- Cacheable health check responses

## Future Enhancements

### Planned Features
- **Authentication**: Admin-only access control
- **Rate Limiting**: Prevent abuse and ensure availability
- **Caching**: Cache search results for performance
- **Analytics**: Track search patterns and performance

### Advanced Debugging
- **Search History**: Track recent search queries
- **Performance Metrics**: Response time tracking
- **Result Quality Scoring**: Automated quality assessment
- **A/B Testing**: Compare different search configurations

### Monitoring Integration
- **Metrics Collection**: Detailed performance metrics
- **Alerting**: Automated alerts for service issues
- **Dashboard Integration**: Visual monitoring displays
- **Log Aggregation**: Centralized logging for analysis

This search debug endpoint provides essential development and monitoring capabilities for the knowledge graph integration in the Mentorfy platform.