import { Component } from '@angular/core';
import {
  EmailStudioConfig,
  EmailStudioDataSetItem,
  EmailStudioImageUploadContext,
  EmailStudioResult,
  NgxEmailStudio,
} from 'ngx-email-studio';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgxEmailStudio],
  template: `
    <main class="demo-page">
      <section class="demo-hero" aria-labelledby="demo-title">
        <div>
          <p class="eyebrow">StackBlitz demo</p>
          <h1 id="demo-title">ngx-email-studio</h1>
          <p>
            Angular 21 frontend email builder with MJML import/export, Data Set helper,
            Text Transform, and a host-owned image upload hook.
          </p>
        </div>
        <a class="repo-link" href="https://github.com/edward124689/ngx-email-studio" target="_blank" rel="noreferrer">
          GitHub repo
        </a>
      </section>

      <ngx-email-studio
        [mjml]="initialMjml"
        [showSave]="true"
        [dataSet]="mergeTags"
        [config]="studioConfig"
        (change)="onChange($event)"
        (save)="onSave($event)"
      />

      <section class="demo-output" aria-label="Latest output summary">
        <strong>Latest output</strong>
        <span>{{ latestSummary }}</span>
      </section>
    </main>
  `,
})
export class App {
  latestSummary = 'Edit the template or click Save to see emitted MJML / HTML sizes.';

  mergeTags: EmailStudioDataSetItem[] = [
    { key: '{%CLIENT_NAME%}', desc: 'Client name' },
    { key: '{%ORDER_ID%}', desc: 'Order ID' },
    { key: '{%DELIVERY_DATE%}', desc: 'Estimated delivery date' },
    { key: '{%SUPPORT_EMAIL%}', desc: 'Support contact email' },
  ];

  studioConfig: EmailStudioConfig = {
    title: 'Email Studio',
    showSave: true,
    uploadImage: async (file: File, context: EmailStudioImageUploadContext) => {
      // Demo-only: StackBlitz has no storage backend. A real host app should upload
      // the File to its own API/storage provider and return the persisted public URL.
      await new Promise((resolve) => setTimeout(resolve, 450));
      const safeName = file.name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 48) || 'uploaded-image';
      const label = encodeURIComponent(`Uploaded ${safeName}`);

      return {
        url: `https://placehold.co/1200x630/png?text=${label}`,
        alt: `Uploaded preview for ${context.nodeId}`,
      };
    },
  };

  initialMjml = `
<mjml>
  <mj-body background-color="#f3f7fb">
    <mj-section background-color="#0f172a" padding="40px 32px">
      <mj-column>
        <mj-text color="#93c5fd" font-size="13px" font-weight="bold" letter-spacing="2px" align="center">
          PRODUCT UPDATE · {%CLIENT_NAME%}
        </mj-text>
        <mj-text color="#ffffff" font-size="34px" line-height="40px" font-weight="bold" align="center">
          Build responsive emails visually in Angular
        </mj-text>
        <mj-text color="#dbeafe" font-size="16px" line-height="24px" align="center">
          Try the builder shell, drag content modules, copy merge tags, transform text,
          upload a demo image, and export MJML or HTML from the toolbar.
        </mj-text>
        <mj-button href="https://www.npmjs.com/package/ngx-email-studio" background-color="#2563eb" color="#ffffff" border-radius="10px" font-weight="bold">
          View npm package
        </mj-button>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="28px 32px">
      <mj-column width="50%" padding="8px">
        <mj-text font-size="18px" font-weight="bold" color="#0f172a">Frontend-only</mj-text>
        <mj-text color="#475569" line-height="22px">
          No backend MJML renderer is required for the supported editable subset.
        </mj-text>
      </mj-column>
      <mj-column width="50%" padding="8px">
        <mj-text font-size="18px" font-weight="bold" color="#0f172a">Host integrations</mj-text>
        <mj-text color="#475569" line-height="22px">
          Provide merge tags and an upload hook from your Angular app.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  onChange(result: EmailStudioResult): void {
    this.latestSummary = this.describeResult('Change emitted', result);
  }

  onSave(result: EmailStudioResult): void {
    this.latestSummary = this.describeResult('Save emitted', result);
  }

  private describeResult(label: string, result: EmailStudioResult): string {
    return `${label}: ${result.mjml.length.toLocaleString()} MJML chars · ${result.html.html.length.toLocaleString()} HTML chars`;
  }
}
