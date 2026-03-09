import React, { useEffect, useRef, useState } from 'react';
import { AppConfig, ChatImage, ChatImagePayload, ChatMessage, Gem } from '../types';
import { generateGemResponse } from '../services/geminiService';
import { Bot, ImagePlus, Send, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface GemChatProps {
  gems: Gem[];
  config: AppConfig;
}

const MAX_UPLOADS = 4;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const markdownComponents = {
  a: ({ ...props }: any) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="break-all text-blue-600 underline dark:text-blue-400"
    />
  ),
  p: ({ ...props }: any) => <p {...props} className="break-words whitespace-pre-wrap" />,
  ul: ({ ...props }: any) => <ul {...props} className="break-words pl-5" />,
  ol: ({ ...props }: any) => <ol {...props} className="break-words pl-5" />,
  li: ({ ...props }: any) => <li {...props} className="break-words" />,
  pre: ({ ...props }: any) => (
    <pre
      {...props}
      className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-gray-900 p-4 text-sm text-gray-100"
    />
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code
          {...props}
          className="break-all rounded bg-black/10 px-1.5 py-0.5 text-[0.9em] dark:bg-white/10"
        >
          {children}
        </code>
      );
    }

    return (
      <code {...props} className={`${className ?? ''} whitespace-pre-wrap break-words`}>
        {children}
      </code>
    );
  },
  img: ({ alt, ...props }: any) => (
    <img
      {...props}
      alt={alt ?? 'Generated content'}
      className="mt-3 max-h-96 w-full rounded-2xl border border-gray-200 object-contain dark:border-gray-600"
    />
  ),
};

const fileToChatImage = (file: File): Promise<ChatImage> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Unable to read "${file.name}".`));
        return;
      }

      resolve({
        dataUrl: reader.result,
        mimeType: file.type,
        name: file.name,
      });
    };

    reader.onerror = () => reject(new Error(`Unable to read "${file.name}".`));
    reader.readAsDataURL(file);
  });

const toImagePayload = (image: ChatImage): ChatImagePayload => ({
  data: image.dataUrl.split(',')[1] ?? '',
  mime_type: image.mimeType,
  name: image.name,
});

const fromImagePayload = (image: ChatImagePayload): ChatImage => ({
  dataUrl: `data:${image.mime_type};base64,${image.data}`,
  mimeType: image.mime_type,
  name: image.name,
});

const AttachmentPreview: React.FC<{
  image: ChatImage;
  onRemove?: () => void;
}> = ({ image, onRemove }) => (
  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
    <img
      src={image.dataUrl}
      alt={image.name ?? 'Chat attachment'}
      className="h-28 w-full object-cover"
    />
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/75"
        aria-label={`Remove ${image.name ?? 'attachment'}`}
      >
        <X size={14} />
      </button>
    )}
    {image.name && (
      <div className="truncate border-t border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
        {image.name}
      </div>
    )}
  </div>
);

const GemChat: React.FC<GemChatProps> = ({ gems, config }) => {
  const [selectedGemId, setSelectedGemId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [generateImages, setGenerateImages] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGem = gems.find((gem) => gem.id === selectedGemId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleGemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGemId(e.target.value);
    setMessages([]);
    setPendingImages([]);
  };

  const addPendingFiles = async (files: File[]) => {
    if (!files.length) {
      return;
    }

    const remainingSlots = MAX_UPLOADS - pendingImages.length;
    const acceptedFiles = files.slice(0, Math.max(remainingSlots, 0));

    if (remainingSlots <= 0) {
      alert(`You can attach up to ${MAX_UPLOADS} images per message.`);
      return;
    }

    const oversizedFile = acceptedFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFile) {
      alert(`"${oversizedFile.name}" is larger than 5 MB.`);
      return;
    }

    const invalidFile = acceptedFiles.find((file) => !file.type.startsWith('image/'));
    if (invalidFile) {
      alert(`"${invalidFile.name}" is not an image file.`);
      return;
    }

    try {
      const nextImages = await Promise.all(acceptedFiles.map(fileToChatImage));
      setPendingImages((prev) => [...prev, ...nextImages].slice(0, MAX_UPLOADS));
    } catch (error: any) {
      alert(error.message || 'Unable to attach image.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await addPendingFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedGem || isProcessing) {
      return;
    }
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragActive(false);

    if (!selectedGem || isProcessing) {
      return;
    }

    const files = Array.from(e.dataTransfer.files ?? []);
    await addPendingFiles(files);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGem || isProcessing) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt && pendingImages.length === 0) {
      return;
    }

    const outgoingImages = [...pendingImages];
    const userMsg: ChatMessage = {
      role: 'user',
      text: trimmedPrompt || 'Attached image(s).',
      timestamp: Date.now(),
      images: outgoingImages,
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setPendingImages([]);
    setIsProcessing(true);

    try {
      const response = await generateGemResponse(
        '',
        selectedGem.instructions,
        trimmedPrompt || 'Please analyze the attached image.',
        {
          images: outgoingImages.map(toImagePayload),
          generateImages,
        }
      );

      const aiMsg: ChatMessage = {
        role: 'model',
        text: response.text,
        timestamp: Date.now(),
        images: response.images.map(fromImagePayload),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        role: 'model',
        text: `**Error:** ${error.message || 'Something went wrong.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (gems.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <Sparkles size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
        <p>No Gems available.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors duration-200 dark:border-gray-700 dark:bg-gray-800">
      <div className="z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col max-w-md">
            <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Gem
            </label>
            <select
              value={selectedGemId}
              onChange={handleGemChange}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="" disabled>
                -- Select a Gem --
              </option>
              {gems.map((gem) => (
                <option key={gem.id} value={gem.id}>
                  {gem.name}
                </option>
              ))}
            </select>
          </div>
          {selectedGem && (
            <div className="hidden min-w-0 border-l border-gray-200 pl-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400 md:block">
              <p className="truncate">{selectedGem.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white p-4 dark:bg-gray-800">
        {!selectedGem && (
          <div className="flex h-full flex-col items-center justify-center opacity-60">
            <Bot size={64} className="mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-center text-lg text-gray-500 dark:text-gray-400">
              Select a Gem to start chatting
            </p>
          </div>
        )}

        {selectedGem && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 opacity-80 dark:text-gray-500">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
              <Sparkles className="text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="mb-2 text-xl font-medium text-gray-800 dark:text-gray-200">Hello!</h3>
            <p className="text-center">
              I am ready to act as <strong>{selectedGem.name}</strong>.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                  <Sparkles size={14} className="text-white" />
                </div>
              )}

              <div
                className={`min-w-0 max-w-[min(85%,48rem)] overflow-hidden rounded-3xl px-5 py-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-[#1a73e8] text-white'
                    : 'rounded-tl-sm bg-[#f1f3f4] text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                }`}
              >
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-3 grid gap-3 sm:grid-cols-2">
                    {msg.images.map((image, imageIdx) => (
                      <img
                        key={`${msg.timestamp}-${imageIdx}`}
                        src={image.dataUrl}
                        alt={image.name ?? 'Chat attachment'}
                        className="max-h-96 w-full rounded-2xl border border-black/10 object-contain bg-white/70 dark:border-white/10 dark:bg-gray-800/60"
                      />
                    ))}
                  </div>
                )}

                {msg.role === 'model' ? (
                  <div className="min-w-0 overflow-hidden break-words prose prose-sm max-w-none prose-p:my-3 prose-p:text-gray-800 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-900 prose-pre:my-4 dark:prose-p:text-gray-100 dark:prose-headings:text-white dark:prose-strong:text-white dark:prose-code:text-white">
                    <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="flex items-center rounded-2xl rounded-tl-sm bg-[#f1f3f4] px-5 py-4 dark:bg-gray-700">
                <div className="flex space-x-2">
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <form
          onSubmit={handleSend}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mx-auto flex max-w-4xl flex-col gap-3 rounded-3xl border p-3 transition-all duration-200 hover:bg-white hover:shadow-md dark:bg-gray-700 dark:hover:bg-gray-600 ${
            isDragActive
              ? 'border-blue-400 bg-blue-50 shadow-md dark:border-blue-400 dark:bg-blue-900/20'
              : 'border-gray-200 bg-gray-100 dark:border-gray-600'
          }`}
        >
          {isDragActive && (
            <div className="rounded-2xl border border-dashed border-blue-400 bg-white/80 px-4 py-3 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              Drop image files here to attach them to the chat.
            </div>
          )}

          {pendingImages.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pendingImages.map((image, idx) => (
                <AttachmentPreview
                  key={`${image.name ?? 'attachment'}-${idx}`}
                  image={image}
                  onRemove={() =>
                    setPendingImages((prev) => prev.filter((_, imageIdx) => imageIdx !== idx))
                  }
                />
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              selectedGem
                ? `Message ${selectedGem.name}. Attach an image or ask for one to be generated.`
                : 'Select a gem first...'
            }
            disabled={!selectedGem || isProcessing}
            rows={3}
            className="w-full resize-none rounded-2xl border-0 bg-transparent px-3 py-2 text-gray-800 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-400"
          />

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-3 dark:border-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedGem || isProcessing || pendingImages.length >= MAX_UPLOADS}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <ImagePlus size={16} />
                Add image
              </button>
              <button
                type="button"
                onClick={() => setGenerateImages((prev) => !prev)}
                disabled={!selectedGem || isProcessing}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  generateImages
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {generateImages ? 'Image responses on' : 'Image responses off'}
              </button>
            </div>

            <button
              type="submit"
              disabled={!selectedGem || isProcessing || (!prompt.trim() && pendingImages.length === 0)}
              className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1765cc] disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-white/80 dark:disabled:bg-gray-600"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </form>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Gemini may display inaccurate info, including about people, so double-check its
            responses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GemChat;
