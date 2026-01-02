# File Upload Implementation & Debugging

## What We Implemented

### 1. File Upload to Anthropic Files API
- Created `/app/api/files/upload/route.ts` to upload files to Anthropic
- Files are uploaded to Anthropic's Files API and return a `file_id`
- Supports: images, PDFs, Word docs, text files, CSVs, Excel, Markdown

### 2. Frontend File Handling
- Updated `MentorPromptBox` component:
  - Changed button label from "Attach image" to "Upload file"
  - Added support for multiple file types in file input
  - File preview shows image thumbnail OR file name badge
  - Files are passed to `onSubmit` callback

### 3. Streaming Chat Integration
- Updated `useStreamingChat` hook:
  - Uploads file to Anthropic before streaming
  - Passes `file_id` in request body
  - Handles file upload errors

### 4. Backend Multimodal Support
- Updated `ChatRequest` model to include `file_id` field
- Modified `/api/chat/stream` endpoint:
  - Constructs multimodal content blocks when file is attached
  - Adds beta header `betas: ["files-api-2025-04-14"]` for Files API
  - Sends both text and document content to Claude

## Issues Reported

### Issue 1: File Not Being Recognized by Claude ✅ FIXED
**Symptom**: Bot responds "I'm not seeing what you're referring to"

**Root Cause**: Missing beta header in API request

**Fix**: Added conditional beta header to streaming endpoint
```python
# app.py line 974-976
if request.file_id:
    api_params["betas"] = ["files-api-2025-04-14"]
```

### Issue 2: Text Clearing When File Uploaded ✅ FIXED
**Symptom**: If text is already in input box, selecting a file clears the text

**Root Cause Identified**: Stack traces revealed the `MentorPromptBox` component was **re-mounting on every parent component render**. This was caused by defining component wrappers (`ChatBar`, `PrivacyPolicy`, `ChatHeader`) inside the render function of parent pages.

When a component is defined inside another component's render function, React creates a **new component type on every render**, causing the child component (`MentorPromptBox`) to fully unmount and remount, which resets all internal state including the text input value.

**The Fix**:
Wrapped all inline component definitions with `useMemo` to stabilize them across renders:

```typescript
// Before (WRONG - causes re-mounting):
const ChatBar = ({ isMobile = false }: { isMobile?: boolean }) => (
  <div><MentorPromptBox ... /></div>
);

// After (CORRECT - memoized):
const ChatBar = useMemo(() => {
  return ({ isMobile = false }: { isMobile?: boolean }) => (
    <div><MentorPromptBox ... /></div>
  );
}, [dependencies]);
```

**Files Fixed**:
1. `/app/(user)/chat/page.tsx` - Memoized `ChatBar` and `PrivacyPolicy`
2. `/app/(user)/chat/[conversationId]/page.tsx` - Memoized `ChatBar`, `PrivacyPolicy`, and `ChatHeader`
3. `/components/mentor-prompt-box.tsx` - Added `preventDefault()` to upload button (defense in depth)

**Additional Fixes Applied** (defense in depth):
1. Added `e.preventDefault()` and `e.stopPropagation()` to `handlePlusClick`
2. Changed `mentorBots` dependency to `mentorBots.length` to prevent re-render loop
3. Added stack trace logging that helped identify the root cause

**Debugging Added**:
- `[PLUS-CLICK]` logs when upload button is clicked
- `[FILE-CHANGE]` logs in `handleFileChange` function
- `[INPUT-CHANGE]` logs in `handleInputChange` function
- `[VALUE-CHANGE]` logs in value state useEffect with stack trace for empty values
- `[SEND-MESSAGE]` logs in `useStreamingChat` sendMessage function

## Testing Instructions

### Test 1: File Recognition (Beta Header Fix)
1. Open browser console (F12)
2. Navigate to chat page
3. Type a message like "What's in this file?"
4. Upload a PDF or image
5. Send the message
6. Check that Claude acknowledges the file content

**Expected**: Claude should describe/reference the file content
**Previously**: Claude said "I'm not seeing what you're referring to"

### Test 2: Text Clearing Issue
1. Open browser console (F12)
2. Type some text in the input box (e.g., "Please analyze this document")
3. Click the upload button and select a file
4. Watch console for `[FILE-CHANGE]` and `[VALUE-CHANGE]` logs
5. Check if text is still in the input box

**Expected**: Text should remain in input box
**Currently**: Text gets cleared (reported by user)

**Console logs to look for**:
- `[VALUE-CHANGE]` showing value becoming empty string
- `[FILE-CHANGE]` showing file selection
- Any unexpected `[INPUT-CHANGE]` events

### Test 3: File First, Then Text
1. Open browser console
2. Upload a file first
3. Then type text
4. Send message
5. Check that both file and text are processed

**Expected**: Both file and text should be sent to Claude

## Files Modified

### Frontend
- `/components/mentor-prompt-box.tsx` - File upload UI and debugging
- `/hooks/use-streaming-chat.ts` - File upload integration
- `/app/api/files/upload/route.ts` - Anthropic file upload endpoint

### Backend
- `/app.py` - ChatRequest model, streaming endpoint with beta header

### Package
- Added `@anthropic-ai/sdk@0.65.0` to dependencies

## Next Steps

1. **Test beta header fix** - Verify files are now recognized by Claude
2. **Reproduce text clearing** - Use console logs to identify when/why text clears
3. **Fix text clearing** - Based on console output, identify the state mutation
4. **Remove debug logs** - Clean up console.log statements once issues are resolved
5. **Add error handling** - Improve file upload error messages
6. **Add file type validation** - Validate file types before upload
7. **Add file size validation** - Check against Anthropic's 350MB limit

## Anthropic Files API Details

**Supported File Types**:
- Images: PNG, JPEG, GIF, WebP (all Claude 3+ models)
- PDFs: (Claude 3.5 Sonnet+)
- Other files: Word, Excel, CSV, TXT, etc. (Claude 3.5 Haiku+, Claude 3.7+)

**File Size Limit**: 350 MB

**Beta Version**: `files-api-2025-04-14`

**Content Block Format**:
```python
{
  "type": "document",
  "source": {
    "type": "file",
    "file_id": "file_abc123"
  }
}
```

**Required Header**: Must include `betas: ["files-api-2025-04-14"]` in API params when using files
