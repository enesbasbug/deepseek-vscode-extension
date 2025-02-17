import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('personalassistant-ext.start', async () => {
        // Get the active text editor and any selected text
        const editor = vscode.window.activeTextEditor;
        const selection = editor?.selection;
        const highlightedText = editor?.document.getText(selection);

        const panel = vscode.window.createWebviewPanel(
            'deepChat',
            'DeepSeek Chat',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
            }
        );

        // Get paths to media files
        const mediaPath = vscode.Uri.joinPath(context.extensionUri, 'media');
        const htmlPath = vscode.Uri.joinPath(mediaPath, 'webview.html');
        const cssPath = vscode.Uri.joinPath(mediaPath, 'main.css');
        const jsPath = vscode.Uri.joinPath(mediaPath, 'webview.js');

        try {
            // Read file contents
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
            const cssContent = fs.readFileSync(cssPath.fsPath, 'utf-8');
            const jsContent = fs.readFileSync(jsPath.fsPath, 'utf-8');

            // Generate nonce
            const nonce = getNonce();

            // Replace placeholders in HTML content
            const webviewContent = htmlContent
                .replace(/\${nonce}/g, nonce)
                .replace(/\${webview\.cspSource}/g, panel.webview.cspSource)
                .replace('<!-- STYLES -->', `<style>${cssContent}</style>`)
                .replace('<!-- SCRIPTS -->', `<script nonce="${nonce}">${jsContent}</script>`)
                .replace('${highlightedText}', JSON.stringify(highlightedText || ''));

            panel.webview.html = webviewContent;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message: any) => {
                if (message.command === 'chat') {
                    console.log('Received chat command with text:', message.text);
                    let contextualPrompt = message.text;

                    if (highlightedText) {
                        contextualPrompt = `Selected code/text:\n${highlightedText}\n\nUser question: ${message.text}`;
                    }

                    try {
                        const streamResponse = await ollama.chat({
                            model: 'deepseek-r1:8b',
                            messages: [{ role: 'user', content: contextualPrompt }],
                            stream: true,
                        });

                        let responseText = '';
                        for await (const part of streamResponse) {
                            responseText += part.message.content;
                            // Send the raw response - formatting will be handled by the webview
                            panel.webview.postMessage({
                                command: 'chatResponse',
                                text: responseText
                            });
                        }
                    } catch (error) {
                        console.error('Error from Deepseek:', error);
                        panel.webview.postMessage({
                            command: 'chatResponse',
                            text: 'Error: ' + String(error)
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error setting up webview:', error);
            vscode.window.showErrorMessage('Failed to load chat interface. Check the console for details.');
        }
    });

    context.subscriptions.push(disposable);
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {}