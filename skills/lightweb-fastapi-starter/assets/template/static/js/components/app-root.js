import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

class AppRoot extends LitElement {
    static properties = {
        currentView: { type: String }
    };

    constructor() {
        super();
        this.currentView = 'home';
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div data-role="appbar" class="bg-white shadow-sm">
                <div class="container mx-auto px-4">
                    <div class="flex items-center justify-between h-16">
                        <a href="/" class="flex items-center gap-3 text-slate-900 no-underline hover:text-primary transition-colors">
                            <i class="fas fa-rocket text-2xl text-primary"></i>
                            <span class="text-xl font-semibold">{{project_name}}</span>
                        </a>
                        
                        <div class="flex items-center gap-4">
                            <span class="text-sm text-slate-600">
                                <i class="fas fa-code mr-1"></i>
                                v${document.querySelector('meta[name="version"]')?.content || '0.1.0'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="pt-4">
                ${this.currentView === 'home' ? html`<app-grid></app-grid>` : ''}
            </div>
        `;
    }
}

customElements.define('app-root', AppRoot);
