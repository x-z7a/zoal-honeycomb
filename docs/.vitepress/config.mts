import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'zoal-honeycomb',
  description: 'Honeycomb Bravo profiles for X-Plane',
  lang: 'en-US',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Install', link: '/install' },
      { text: 'Supported Planes', link: '/supported-planes' },
      { text: 'Profiles Guide', link: 'https://github.com/x-z7a/zoal-honeycomb/blob/main/PROFILES.md' },
      { text: 'WebGA', link: 'https://zoal.app/' }
    ],
    sidebar: [
      {
        text: 'Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Install', link: '/install' },
          { text: 'Supported Planes', link: '/supported-planes' },
          { text: 'Roadmap', link: '/roadmap' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/x-z7a/zoal-honeycomb' }
    ]
  }
})
