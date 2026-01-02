'use client';

import { useRef, useEffect } from 'react';
import type { StreamingChatMessage } from '@/hooks/use-streaming-chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileAttachmentPreview } from '@/components/file-attachment-preview';
import { useTypewriter } from '@/hooks/use-typewriter';
import { ThinkingIndicator } from '@/components/thinking-indicator';

interface StreamingChatMessageProps {
  message: StreamingChatMessage;
  userInitials?: string;
  botInitials?: string;
  isProcessing?: boolean;
  /** Whether the first token has been received (for showing thinking indicator) */
  hasFirstToken?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StreamingChatMessage({
  message,
  userInitials = 'U',
  botInitials = 'AI',
  isProcessing = false,
  hasFirstToken = false,
}: StreamingChatMessageProps) {
  const isUser = message.role === 'user';

  // Track if this message has ever been streamed (use ref to avoid re-renders)
  const hasBeenStreamedRef = useRef(false);
  if (message.isStreaming) {
    hasBeenStreamedRef.current = true;
  }

  // Skip typewriter effect for very long messages (>2000 chars) to prevent performance issues
  const TYPEWRITER_CHAR_THRESHOLD = 2000;
  const messageContent = message.content || '';
  const shouldUseTypewriter =
    hasBeenStreamedRef.current &&
    messageContent.length < TYPEWRITER_CHAR_THRESHOLD;

  // Apply fixed-speed typewriter effect to assistant messages that have been streamed
  const { displayedText, remainingText, shouldFadeIn } = useTypewriter({
    text: shouldUseTypewriter ? messageContent : '',
    isStreaming: message.isStreaming,
    speed: 5, // Fixed typing speed: 5ms/char (~200 chars/second)
    startDelay: 300, // 300ms buffer before typing starts
  });

  // Use typewriter for messages that have been streamed, otherwise show content directly
  // When fade-in is active, show the complete message (typed + remaining)
  const contentToDisplay =
    !isUser && shouldUseTypewriter
      ? shouldFadeIn
        ? messageContent
        : displayedText
      : messageContent;

  // Don't show message bubble until we have content to display
  // For assistant messages with typewriter, wait until displayedText has content
  const shouldShowBubble =
    isUser ||
    (shouldUseTypewriter ? displayedText.length > 0 : contentToDisplay);

  // Show thinking indicator for assistant messages that are currently streaming
  const shouldShowThinkingIndicator =
    !isUser && message.isStreaming && !shouldShowBubble;

  return (
    <div className="mb-8">
      <div className="flex justify-start">
        <div className="flex flex-col items-start">
          {/* Show new multi-file attachments */}
          {isUser && message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="font-medium">{file.name}</span>
                  {file.size && (
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(file.size)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy single file attachment support */}
          {isUser &&
            !message.files &&
            (message.fileType || message.fileBase64 || message.fileId) && (
              <FileAttachmentPreview
                fileType={message.fileType}
                fileName={message.fileName}
                fileBase64={message.fileBase64}
                fileId={message.fileId}
                readOnly={true}
                size="sm"
              />
            )}

          {/* Show thinking indicator before typewriter starts */}
          {shouldShowThinkingIndicator && (
            <ThinkingIndicator
              isThinking={message.isStreaming || false}
              hasFirstToken={false}
              timeToFirstToken={0}
            />
          )}

          {shouldShowBubble && (
            <>
              <div
                className={`max-w-full leading-relaxed overflow-wrap-anywhere ${
                  isUser
                    ? 'text-lg bg-blue-500 text-white rounded-[18px] shadow-sm flex items-center gap-3 px-4 py-2.5'
                    : 'text-lg text-gray-900 dark:text-gray-100'
                }`}
              >
                {isUser ? (
                  <>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                      {userInitials}
                    </div>
                    <p className="font-primary break-all whitespace-pre-wrap flex-1">
                      {contentToDisplay?.trim()}
                    </p>
                  </>
                ) : (
                  <div
                    className={`font-primary markdown-content ${
                      shouldFadeIn ? 'animate-in fade-in duration-300' : ''
                    }`}
                    style={
                      shouldFadeIn
                        ? { animationFillMode: 'backwards' }
                        : undefined
                    }
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({
                          node,
                          inline,
                          className,
                          children,
                          ...props
                        }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeContent = String(children).replace(
                            /\n$/,
                            ''
                          );

                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-md my-2 text-xs"
                              {...props}
                            >
                              {codeContent}
                            </SyntaxHighlighter>
                          ) : (
                            <code
                              className={`${className} bg-gray-300 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-primary`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p({ children }) {
                          return <p className="mb-2 last:mb-0">{children}</p>;
                        },
                        ul({ children }) {
                          return (
                            <ul className="list-disc list-inside mb-2 space-y-1">
                              {children}
                            </ul>
                          );
                        },
                        ol({ children }) {
                          return (
                            <ol className="list-decimal list-inside mb-2 space-y-1">
                              {children}
                            </ol>
                          );
                        },
                        li({ children }) {
                          return <li className="ml-2">{children}</li>;
                        },
                        a({ href, children }) {
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {children}
                            </a>
                          );
                        },
                        strong({ children }) {
                          return (
                            <strong className="font-semibold">
                              {children}
                            </strong>
                          );
                        },
                        em({ children }) {
                          return <em className="italic">{children}</em>;
                        },
                        h1({ children }) {
                          return (
                            <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">
                              {children}
                            </h1>
                          );
                        },
                        h2({ children }) {
                          return (
                            <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">
                              {children}
                            </h2>
                          );
                        },
                        h3({ children }) {
                          return (
                            <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">
                              {children}
                            </h3>
                          );
                        },
                        blockquote({ children }) {
                          return (
                            <blockquote className="border-l-4 border-gray-400 dark:border-gray-600 pl-3 my-2 italic">
                              {children}
                            </blockquote>
                          );
                        },
                        hr() {
                          return (
                            <hr className="my-3 border-gray-300 dark:border-gray-700" />
                          );
                        },
                      }}
                    >
                      {contentToDisplay?.trim() || ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Timestamp (with time-to-first-token for assistant messages only) */}
              {!isUser && (
                <span className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {!message.isStreaming &&
                    message.firstTokenTime &&
                    message.firstTokenTime > 0 && (
                      <>
                        <span className="mx-1.5">•</span>
                        <span>
                          {(message.firstTokenTime / 100).toFixed(2)}s
                        </span>
                      </>
                    )}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
