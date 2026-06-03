import { Component } from '@angular/core';
import { NgxEmailStudio, EmailDocument, EmailStudioConfig } from 'ngx-email-studio';


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

  studioConfig: EmailStudioConfig = {
    title: '會員召回電郵 · Email Builder',
    breadcrumb: 'CMS / 電郵活動 / 草稿',
    statusLabel: '已儲存草稿',
    fromLabel: 'cms@brand.test',
  };

  initialDocument: EmailDocument = {
    version: '0.0.1',
    body: [
      {
        id: 'hero_text',
        type: 'text',
        attrs: {
          content:
            '<p class="kicker">會員專屬更新</p><h1>今週精選內容已為你整理好</h1><p>用一封清晰、可編輯的 EDM，將 CMS 最新文章、商品與優惠同步發送給會員。</p>',
          backgroundColor: '#ffffff',
        },
      },
      {
        id: 'cms_image',
        type: 'image',
        attrs: {
          src: 'https://placehold.co/1200x420/d9f99d/172033?text=CMS+%E5%9C%96%E7%89%87%E8%B3%87%E7%94%A2',
          alt: 'CMS 圖片資產',
          backgroundColor: '#ffffff',
        },
      },
      {
        id: 'summary_text',
        type: 'text',
        attrs: {
          content: '<h2>內容摘要</h2><p>這段內容會由 CMS 編輯直接維護，可用於活動說明、文章導讀或會員公告。</p>',
          backgroundColor: '#ffffff',
        },
      },
      {
        id: 'two_col_row',
        type: 'row',
        attrs: { backgroundColor: '#ffffff' },
        children: [
          {
            id: 'left_col',
            type: 'column',
            attrs: { width: '50%', backgroundColor: '#ffffff' },
            children: [
              {
                id: 'left_col_text',
                type: 'text',
                attrs: {
                  content: '<h2>左欄內容</h2><p>放文章摘要、商品賣點或活動條件。</p>',
                  backgroundColor: '#ffffff',
                },
              },
            ],
          },
          {
            id: 'right_col',
            type: 'column',
            attrs: { width: '50%', backgroundColor: '#ffffff' },
            children: [
              {
                id: 'right_col_text',
                type: 'text',
                attrs: {
                  content: '<h2>右欄內容</h2><p>放第二組內容，MJML 匯出時會變成第二個 column。</p>',
                  backgroundColor: '#ffffff',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'cta_button',
        type: 'button',
        attrs: {
          label: '查看活動',
          href: 'https://github.com/edward124689/ngx-email-studio',
          backgroundColor: '#0f172a',
        },
      },
      {
        id: 'footer_info',
        type: 'text',
        attrs: {
          content: '<p>你收到此電郵是因為你訂閱了 CMS 會員更新。可於會員中心調整通知偏好或取消訂閱。</p>',
          backgroundColor: '#f1f5f9',
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
