const vscode = acquireVsCodeApi();

// Helper function to preserve code formatting when copying
function preserveCodeFormatting(code) {
    // Remove any HTML entities and restore to original characters
    return code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        // Preserve indentation
        .split('\n')
        .map(line => line.replace(/^\s+/, match => match))
        .join('\n')
        // Ensure consistent line endings
        .replace(/\r\n/g, '\n');
}

// Updated copyToClipboard function
function copyToClipboard(button, text) {
    const formattedText = preserveCodeFormatting(text);
    
    navigator.clipboard.writeText(formattedText).then(() => {
        button.textContent = 'Copied!';
        button.style.background = 'var(--vscode-button-hoverBackground)';
        
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        button.textContent = 'Error!';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    });
}

// Updated copyCodeBlock function
function copyCodeBlock(button) {
    const codeElement = button.parentElement.parentElement.querySelector('code');
    const textToCopy = preserveCodeFormatting(codeElement.textContent);

    navigator.clipboard.writeText(textToCopy).then(() => {
        button.textContent = 'Copied!';
        button.style.background = 'var(--vscode-button-hoverBackground)';
        
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        button.textContent = 'Error!';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    });
}

// Updated formatSelectedText function
function formatSelectedText(text) {
    console.log("Selected text in formatSelectedText: ", text);
    // If text is undefined, null, empty string, or just whitespace, return null
    if (!text || text.trim().length === 0) {
        return null;
    }

    if ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))) {
        text = text.substring(1, text.length - 1);
    }
    
    // Store original formatting in a data attribute
    const originalText = text;
    
    return '<div class="code-block">' +
        '<div class="code-header">' +
            '<div class="language-label">Selected Text</div>' +
            '<button class="copy-button" ' +
                'onclick="copyToClipboard(this, `' + originalText + '`)">Copy</button>' +
        '</div>' +
        '<pre><code>' + 
            text.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;') + 
        '</code></pre>' +
    '</div>';
}



function formatMessage(text) {
    // First handle code blocks with language specification
     // Handle code blocks
     text = text.replace(/```(\w+)?\n([\s\S]+?)```/g, function(match, lang, code) {
        return '<div class="code-block">' +
            '<div class="code-header">' +
                '<span class="language-label">' + (lang || 'text') + '</span>' +
                '<button class="copy-button" onclick="copyCodeBlock(this)">Copy</button>' +
            '</div>' +
            '<pre><code>' + 
                code.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;') + 
            '</code></pre>' +
        '</div>';
    });
    
    // Then handle inline code before other markdown
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle other markdown
    text = text
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');

    // Convert line breaks
    text = text.split('\n\n').map(paragraph => {
        if (paragraph.trim()) {
            return `<p>${paragraph}</p>`;
        }
        return paragraph;
    }).join('\n');

    return text;
}

function ChatApp() {
    const [messages, setMessages] = React.useState([]);
    const [input, setInput] = React.useState('');
    const messagesEndRef = React.useRef(null);

    React.useEffect(function() {
        const highlightedContent = `${highlightedText}`;
        
        // If there's no content, initialize empty
        if (!highlightedContent) {
            setMessages([]);
            return;
        }
    
        try {
            // Decode the base64 content
            const decodedContent = atob(highlightedContent);
            
            // Only proceed if we have actual content
            if (decodedContent.trim().length > 0) {
                const formattedText = formatSelectedText(decodedContent);
                if (formattedText) {
                    setMessages([{
                        role: 'system',
                        content: formattedText
                    }]);
                }
            } else {
                setMessages([]);
            }
        } catch (e) {
            // If decoding fails (no base64 content), just set empty messages
            setMessages([]);
        }
    }, []);

    React.useEffect(function() {
        const handleMessage = function(event) {
            const message = event.data;
            if (message.command === 'chatResponse') {
                setMessages(function(prev) {
                    const newMessages = [...prev];
                    if (newMessages.length && newMessages[newMessages.length - 1].role === 'bot') {
                        newMessages[newMessages.length - 1].content = formatMessage(message.text);
                    } else {
                        newMessages.push({
                            role: 'bot',
                            content: formatMessage(message.text)
                        });
                    }
                    return newMessages;
                });
            }
        };

        window.addEventListener('message', handleMessage);
        return function() {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    React.useEffect(function() {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = function() {
        if (!input.trim()) return;

        vscode.postMessage({
            command: 'chat',
            text: input
        });

        setMessages(function(prev) {
            return [...prev, {
                role: 'user',
                content: input
            }];
        });

        setInput('');
    };

    return React.createElement(
        'div',
        { className: 'chat-container' },
        React.createElement(
            'div',
            { className: 'messages' },
            messages.map(function(msg, index) {
                return React.createElement('div', {
                    key: index,
                    className: 'message ' + msg.role,
                    dangerouslySetInnerHTML: { __html: msg.content }
                });
            }),
            React.createElement('div', { ref: messagesEndRef })
        ),
        React.createElement(
            'div',
            { className: 'input-container' },
            React.createElement(
                'div',
                { className: 'input-box' },
                React.createElement('input', {
                    type: 'text',
                    value: input,
                    onChange: function(e) { setInput(e.target.value); },
                    onKeyDown: function(e) { if (e.key === 'Enter') sendMessage(); },
                    placeholder: 'Ask a question...',
                    className: 'chat-input'
                }),
                React.createElement(
                    'button',
                    {
                        onClick: sendMessage,
                        className: 'send-button'
                    },
                    'Send'
                )
            )
        )
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ChatApp));