import { LitElement, html } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

class AppGrid extends LitElement {
    static properties = {
        apps: { type: Array }
    };

    constructor() {
        super();
        this.apps = [
            {
                id: 'feature1',
                title: '功能一',
                description: '第一个示例功能',
                icon: 'fa-star',
                color: '#4ecdc4',
                route: '/feature1'
            },
            {
                id: 'feature2',
                title: '功能二',
                description: '第二个示例功能',
                icon: 'fa-heart',
                color: '#ffeaa7',
                route: '/feature2'
            },
            {
                id: 'feature3',
                title: '功能三',
                description: '第三个示例功能',
                icon: 'fa-bolt',
                color: '#96ceb4',
                route: '/feature3'
            },
            {
                id: 'feature4',
                title: '功能四',
                description: '第四个示例功能',
                icon: 'fa-cog',
                color: '#dfe6e9',
                route: '/feature4'
            }
        ];
    }

    createRenderRoot() {
        return this;
    }

    handleAppClick(app) {
        window.location.href = app.route;
    }

    render() {
        return html`
            <div class="container mx-auto px-4 py-8">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    ${this.apps.map(app => html`
                        <app-card
                            .app=${app}
                            @click=${() => this.handleAppClick(app)}
                        ></app-card>
                    `)}
                </div>
            </div>
        `;
    }
}

customElements.define('app-grid', AppGrid);
