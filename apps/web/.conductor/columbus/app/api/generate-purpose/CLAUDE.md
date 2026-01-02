# CLAUDE.md - AI Purpose Generation Endpoint

This directory contains the AI-powered mentor purpose statement generation functionality, enabling users to create customized mentor personas using OpenAI's language models.

## File Overview

### route.ts - Purpose Generation Handler
**Route**: `/api/generate-purpose`
**Methods**: `POST`, `GET`
**Purpose**: Generate customized mentor purpose statements using AI based on coaching parameters

#### Request/Response Interfaces

**POST Request Body**:
```typescript
interface GeneratePurposeRequest {
  coachingType?: string      // Type of coaching (e.g., "business", "life", "career")
  expertise?: string         // Area of expertise (e.g., "content creation", "leadership")
  targetAudience?: string    // Target audience (e.g., "entrepreneurs", "creators")
}
```

**Response Format**:
```typescript
interface GeneratePurposeResponse {
  purpose: string    // Generated purpose statement (200-400 words)
  error?: string     // Error message if generation failed
}
```

#### POST Method Implementation

**Parameter Processing** (Lines 32-36):
```typescript
const coachingType = body.coachingType || 'general'
const expertise = body.expertise || 'personal development'
const targetAudience = body.targetAudience || 'individuals seeking growth'
```

**Features**:
- **Default Values**: Sensible defaults for all parameters
- **Flexible Input**: All parameters optional for ease of use
- **Type Safety**: TypeScript interfaces for request validation

**AI Prompt Engineering** (Lines 38-57):
```typescript
const prompt = `Generate a mentor purpose statement for a ${coachingType} coach with expertise in ${expertise} who works with ${targetAudience}.

The purpose should:
- Define the mentor's primary role and mission
- Explain their coaching methodology and approach
- Include specific guidance on how they conduct conversations
- Be written in first person ("You are...")
- Be 200-400 words
- Include a "###HOW YOU COACH###" section with bullet points

Format example:
You are a [type]-focused coach dedicated to helping [audience] achieve [goals].

Your PRIMARY purpose is to guide [audience] to achieve their goals by providing actionable advice, personalized strategies, and ongoing support rooted in your expertise and experience.

###HOW YOU COACH###
* Begin every conversation by asking clarifying questions...
* [additional bullet points]

Make it sound natural and authentic, not corporate or generic.`
```

**Prompt Design Principles**:
- **Clear Structure**: Specific format requirements and examples
- **Authenticity**: Emphasis on natural, non-corporate tone
- **Completeness**: Comprehensive guidelines for consistent output
- **Flexibility**: Adaptable to different coaching types and audiences

#### OpenAI Integration

**Model Configuration** (Lines 59-67):
```typescript
const completion = await getOpenAIClient().chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant that creates authentic, professional coaching purpose statements.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.8,
  max_tokens: 800,
})
```

**Configuration Rationale**:
- **Model**: GPT-4o-mini for cost-effective, high-quality generation
- **Temperature**: 0.8 for creative but consistent output
- **Max Tokens**: 800 to accommodate 200-400 word requirement
- **System Message**: Sets context for professional, authentic output

**Client Management**:
- **Lazy Loading**: OpenAI client initialized only when needed
- **Error Handling**: Environment variable validation
- **Resource Efficiency**: Reuses client instance across requests

#### GET Method Implementation

**Default Purpose Template** (Lines 94-105):
```typescript
const defaultPurpose = `You are a growth-focused coach and strategist dedicated to helping content creators scale their impact, audience, and revenue.

Your PRIMARY purpose is to guide creators to achieve their goals by providing actionable advice, personalized strategies, and ongoing support rooted in your expertise and experience.

###HOW YOU COACH###
* Begin every conversation by asking clarifying questions to understand the creator's current situation
* Provide specific, actionable steps rather than generic advice
* Share real-world examples and case studies from your experience
* Challenge creators to think bigger while keeping goals realistic
* Focus on systems and processes that scale, not just one-time tactics
* Encourage consistent action-taking over perfectionism`
```

**Use Cases**:
- **Quick Setup**: Instant purpose statement for testing
- **Template Reference**: Example of expected output format
- **Fallback Option**: Available when AI generation unavailable

#### Purpose Statement Structure

**Standard Format**:
1. **Opening Declaration**: "You are a [type]-focused coach..."
2. **Primary Purpose**: Core mission and objectives
3. **Methodology Section**: "###HOW YOU COACH###" with bullet points
4. **Coaching Approach**: Specific conversation guidelines
5. **Value Proposition**: Unique coaching philosophy

**Content Guidelines**:
- **Length**: 200-400 words for optimal AI consumption
- **Tone**: Natural, authentic, professional but not corporate
- **Structure**: Clear sections with actionable guidance
- **Specificity**: Concrete coaching behaviors and approaches

#### Error Handling

**OpenAI Service Errors** (Lines 80-91):
```typescript
try {
  const completion = await getOpenAIClient().chat.completions.create({...})
  const purpose = completion.choices[0]?.message?.content || ''
  
  if (!purpose) {
    return NextResponse.json(
      { purpose: '', error: 'Failed to generate purpose statement' },
      { status: 500 }
    )
  }
} catch (error) {
  return NextResponse.json(
    { purpose: '', error: error instanceof Error ? error.message : 'An unexpected error occurred' },
    { status: 500 }
  )
}
```

**Error Categories**:
- **API Key Missing**: Environment configuration errors
- **Model Unavailable**: OpenAI service interruptions
- **Generation Failure**: Empty or invalid AI responses
- **Network Issues**: Connectivity and timeout problems

## Integration with Behavior Settings

### System Prompt Builder Integration
The generated purpose statements are designed to work with the `buildSystemPrompt()` function in `@/lib/system-prompt-builder.ts`:

```typescript
// Generated purpose becomes part of BehaviorSettings
const behaviorSettings: BehaviorSettings = {
  purpose: generatedPurpose,
  customInstructions: [...],
  speakingStyle: "...",
  responseLength: 'Intelligent',
  creativity: 'Adaptive'
}
```

### Chat API Integration
Purpose statements flow into the chat system:
1. **Generation**: User generates custom purpose via this endpoint
2. **Storage**: Purpose saved in behavior settings
3. **Usage**: Chat API uses purpose in system prompt construction
4. **Conversation**: AI mentor embodies the generated purpose

## Use Cases and Applications

### Mentor Persona Creation
- **Custom Coaches**: Create specialized mentors for specific domains
- **Brand Alignment**: Generate purposes that match organizational voice
- **Expertise Modeling**: Capture specific knowledge areas and approaches
- **Audience Targeting**: Tailor coaching style to specific user groups

### Template Generation
- **Quick Setup**: Generate starting points for manual refinement
- **Inspiration**: Provide ideas for coaching approach development
- **Consistency**: Ensure purpose statements follow proven formats
- **Scalability**: Create multiple mentor variants efficiently

### Development and Testing
- **Prototype Mentors**: Quickly create mentors for feature testing
- **A/B Testing**: Generate variations for effectiveness comparison
- **Quality Benchmarking**: Create baseline purposes for evaluation
- **Documentation**: Generate examples for user guidance

## Performance Considerations

### Response Time Optimization
- **Model Selection**: GPT-4o-mini chosen for speed and cost efficiency
- **Token Limits**: Optimized for fast generation within quality constraints
- **Caching Strategy**: Consider caching common purpose patterns
- **Lazy Loading**: OpenAI client initialized only when needed

### Cost Management
- **Efficient Prompting**: Concise prompts reduce token usage
- **Model Choice**: Cost-effective model for the use case
- **Usage Monitoring**: Track generation costs and patterns
- **Fallback Options**: Free default purposes reduce AI dependency

### Quality Assurance
- **Prompt Engineering**: Carefully crafted prompts for consistent quality
- **Output Validation**: Check for empty or malformed responses
- **Format Consistency**: Structured output requirements
- **Human Review**: Consider approval workflows for generated content

## Security and Content Safety

### Input Validation
- **Parameter Sanitization**: Clean and validate all input parameters
- **Injection Prevention**: Prevent prompt injection attacks
- **Length Limits**: Reasonable limits on input parameter lengths
- **Content Filtering**: Basic filtering for inappropriate content

### Output Safety
- **Content Review**: Consider moderation for generated purposes
- **Brand Safety**: Ensure outputs align with platform values
- **Professional Standards**: Maintain coaching profession standards
- **User Guidelines**: Clear expectations for appropriate use

### API Security
- **Rate Limiting**: Prevent abuse of generation endpoint
- **Authentication**: Consider authentication for generation access
- **Monitoring**: Track usage patterns for abuse detection
- **Logging**: Comprehensive logging for security analysis

## Future Enhancements

### Planned Features
- **Style Variations**: Multiple purpose generation styles
- **Industry Templates**: Pre-built templates for specific industries
- **Refinement Interface**: Interactive purpose editing and improvement
- **Quality Scoring**: Automated quality assessment for generated purposes

### Advanced AI Features
- **Fine-tuning**: Custom models for purpose generation
- **Multi-step Generation**: Iterative refinement processes
- **Persona Consistency**: Ensure generated purposes align with brand
- **Feedback Learning**: Improve generation based on user feedback

### User Experience Improvements
- **Preview Mode**: Show generation preview before saving
- **Comparison Tools**: Compare multiple generated options
- **Version History**: Track purpose statement evolution
- **Sharing Features**: Share and collaborate on purpose statements

### Integration Enhancements
- **Behavior Settings**: Direct integration with mentor configuration
- **Template Library**: Searchable library of purpose statements
- **Export Options**: Multiple format exports (PDF, text, etc.)
- **API Extensions**: Additional endpoints for purpose management

This purpose generation endpoint provides AI-powered mentor persona creation capabilities, enabling users to quickly generate professional, customized coaching purposes that integrate seamlessly with the chat system.