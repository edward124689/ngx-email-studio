import { Component } from '@angular/core';
import { NgxEmailStudio, EmailDocument, EmailStudioConfig, EmailStudioDataSetItem } from 'ngx-email-studio';

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

  mergeTags: EmailStudioDataSetItem[] = [
    { key: '{%CLIENT_NAME%}', desc: 'Client name' },
    { key: '{%ORDER_ID%}', desc: 'Order ID' },
    { key: '{%DELIVERY_DATE%}', desc: 'Estimated delivery date' },
    { key: '{%SUPPORT_EMAIL%}', desc: 'Support contact email' },
  ];

  studioConfig: EmailStudioConfig = {
    title: 'Email Studio',
    fromLabel: 'hello@brand.test',
    richTextEditor: this.resolveRichTextEditor(),
    templates: [
      {
        icon: 'fa-star',
        name: 'Promo template',
        desc: 'Host-provided MJML section from config.templates',
        mjml: '<mj-section background-color="#ecfdf3" padding="20px"><mj-column><mj-text font-size="22px" font-weight="bold" color="#14532d">Custom promo template</mj-text><mj-text color="#166534">Drag templates from config into the canvas and edit them like normal modules.</mj-text><mj-button href="https://www.npmjs.com/package/ngx-email-studio" background-color="#16a34a">Use template</mj-button></mj-column></mj-section>',
      },
      {
        icon: 'https://placehold.co/48x48/2563eb/ffffff.png?text=T',
        name: 'Image icon template',
        desc: 'Template card using an image URL icon',
        mjml: '<mj-section padding="16px"><mj-column><mj-text font-size="18px" font-weight="bold">Image icon template</mj-text><mj-text>This custom template uses a safe image URL as the palette icon.</mj-text></mj-column></mj-section>',
      },
    ],
    uploadImage: async (file) => {
      // Demo-only mock: real apps should upload `file` to their API/CDN and return that URL.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        url: `https://placehold.co/900x420/png?text=${encodeURIComponent(file.name)}`,
        alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Uploaded image',
      };
    },
  } as EmailStudioConfig;

  private resolveRichTextEditor(): EmailStudioConfig['richTextEditor'] {
    const editor = new URL(globalThis.location?.href || 'http://localhost/').searchParams.get('editor');
    return editor === 'plain' || editor === 'tiptap' ? editor : 'tiptap';
  }

  initialDocument: EmailDocument = {
    version: '0.0.1',
    attrs: {
      width: 100,
      widthUnit: '%',
      maxWidth: 600,
      maxWidthUnit: 'px',
    },
    body: [
      {
        id: 'hero_section',
        type: 'section',
        attrs: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, paddingUnit: 'px' },
        children: [
          {
            id: 'hero_text',
            type: 'text',
            attrs: {
              content:
                '<p class="kicker">Product newsletter</p><h1>Launch a polished campaign in minutes</h1><p>Compose responsive MJML emails with reusable content modules, live preview, and clean frontend-only export.</p>',
            },
          },
        ],
      },
      {
        id: 'image_section',
        type: 'section',
        attrs: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, paddingUnit: 'px' },
        children: [
          {
            id: 'hero_image',
            type: 'image',
            attrs: {
              src: 'https://placehold.co/1200x420/d9f99d/172033?text=Email+Studio+Asset',
              alt: 'Email Studio placeholder asset',
            },
          },
        ],
      },
      {
        id: 'summary_section',
        type: 'section',
        attrs: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, paddingUnit: 'px' },
        children: [
          {
            id: 'summary_text',
            type: 'text',
            attrs: {
              content: '<h2>Campaign summary</h2><p>Use this area for product updates, editorial highlights, event details, or member announcements.</p>',
            },
          },
        ],
      },
      {
        id: 'two_col_row',
        type: 'row',
        attrs: {},
        children: [
          {
            id: 'left_col',
            type: 'column',
            attrs: { width: 50, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px' },
            children: [
              {
                id: 'left_col_text',
                type: 'text',
                attrs: {
                  content: '<h2>Primary message</h2><p>Add the main benefit, product detail, or editorial teaser for this campaign.</p>',
                },
              },
            ],
          },
          {
            id: 'right_col',
            type: 'column',
            attrs: { width: 50, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px' },
            children: [
              {
                id: 'right_col_text',
                type: 'text',
                attrs: {
                  content: '<h2>Secondary message</h2><p>Use the second column for supporting context, offer terms, or a related content block.</p>',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'cta_section',
        type: 'section',
        attrs: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, paddingUnit: 'px' },
        children: [
          {
            id: 'cta_button',
            type: 'button',
            attrs: {
              label: 'View campaign',
              href: 'https://github.com/edward124689/ngx-email-studio',
              backgroundColor: '#0f172a',
            },
          },
        ],
      },
      {
        id: 'footer_section',
        type: 'section',
        attrs: { backgroundColor: '#f1f5f9', width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, paddingUnit: 'px' },
        children: [
          {
            id: 'footer_info',
            type: 'text',
            attrs: {
              content: '<p>You are receiving this email because you subscribed to product updates. Manage preferences or unsubscribe from your account settings.</p>',
              backgroundColor: '#f1f5f9',
            },
          },
        ],
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
