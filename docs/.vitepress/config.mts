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
      { text: 'Create Profile', link: '/create-profile' },
      { text: 'Profiles Guide', link: '/profiles' },
      { text: 'Supported Planes', link: '/supported-planes' },
      { text: 'License', link: '/license' },
      { text: 'v1 Docs', link: '/v1/' },
      { text: 'WebGA', link: 'https://zoal.app/' }
    ],
    sidebar: {
      // Archived v1 docs (X-Plane 11, X-Plane 12 before 12.4.4, Intel Mac).
      '/v1/': [
        {
          text: 'v1 Docs (archived)',
          items: [
            { text: 'Overview', link: '/v1/' },
            { text: 'Install', link: '/v1/install' },
            { text: 'Create Profile', link: '/v1/create-profile' },
            { text: 'Profiles Guide', link: '/v1/profiles' },
            { text: 'Supported Planes', link: '/supported-planes' },
            { text: 'Roadmap', link: '/v1/roadmap' },
            { text: 'License', link: '/license' }
          ]
        },
        {
          text: 'Current',
          items: [{ text: 'v2 Docs', link: '/' }]
        }
      ],
      '/': [
      {
        text: 'Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Install', link: '/install' },
          { text: 'Upgrade from v1', link: '/upgrade' },
          { text: 'Create Profile', link: '/create-profile' },
          { text: 'Profiles Guide', link: '/profiles' },
          { text: 'Supported Planes', link: '/supported-planes' },
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'License', link: '/license' }
        ]
      },
      {
        text: 'Older versions',
        items: [{ text: 'v1 Docs (X-Plane 11 / Intel Mac)', link: '/v1/' }]
      }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/x-z7a/zoal-honeycomb' }
    ]
  }
})
