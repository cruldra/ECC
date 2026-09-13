import { LitElement, html } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

class AppCard extends LitElement {
    static properties = {
        app: { type: Object }
    };

    createRenderRoot() {
        return this;
    }

    render() {
        if (!this.app) return html``;
        
        return html`
            <div class="bg-white rounded-xl p-8 text-center cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1 border-2 border-transparent hover:border-primary">
                <div class="text-5xl mb-4" style="color: ${this.app.color}">
                    <i class="fas ${this.app.icon}"></i>
                </div>
                <div class="text-xl font-semibold text-slate-900 mb-2">${this.app.title}</div>
                <div class="text-sm text-slate-600 leading-relaxed">${this.app.description}</div>
            </div>
        `;
    }
}

customElements.define('app-card', AppCard);
