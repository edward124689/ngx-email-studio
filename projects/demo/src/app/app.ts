import { Component } from '@angular/core';
import { NgxEmailStudio, EmailDocument } from 'ngx-email-studio';

@Component({
  selector: 'app-root',
  imports: [NgxEmailStudio],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  title = 'ngx-email-studio-demo';
  latestMjml = '';
  latestHtml = '';

  initialDocument: EmailDocument = {
    version: '0.0.1',
    body: [
      {
        id: 'hero_text',
        type: 'text',
        attrs: {
          content: '<h1>Build email templates visually</h1><p>Angular 21, MJML import/export, responsive preview, and rich text editing in one frontend library.</p>',
          backgroundColor: '#ffffff',
        },
      },
      {
        id: 'hero_button',
        type: 'button',
        attrs: {
          label: 'Export MJML',
          href: 'https://github.com/edward124689/ngx-email-studio',
          backgroundColor: '#7c3aed',
        },
      },
    ],
  };

  onMjmlChange(mjml: string): void {
    this.latestMjml = mjml;
  }

  onHtmlExport(html: string): void {
    this.latestHtml = html;
  }
}
