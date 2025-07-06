// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Mortgage Broker Pro 3.0',
  tagline: 'Next-Generation Loan Shopping Platform',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.mortgagebroker.pro',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'mortgage-broker-pro',
  projectName: 'mortgage-broker-pro-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/mortgage-broker-pro/docs/tree/main/',
          remarkPlugins: [require('remark-math')],
          rehypePlugins: [require('rehype-katex')],
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/mortgage-broker-pro/docs/tree/main/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'apiDocs',
        docsPluginId: 'classic',
        config: {
          mortgagebroker: {
            specPath: './api/openapi.yaml',
            outputDir: './docs/api-reference',
            downloadUrl: 'https://raw.githubusercontent.com/mortgage-broker-pro/docs/main/openapi.yaml',
            sidebarOptions: {
              groupPathsBy: 'tag',
              categoryLinkSource: 'tag',
            },
          },
        },
      },
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'Mortgage Broker Pro',
        logo: {
          alt: 'Mortgage Broker Pro Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            to: '/docs/api-reference',
            label: 'API Reference',
            position: 'left',
          },
          {
            to: '/docs/adr',
            label: 'Architecture',
            position: 'left',
          },
          {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/mortgage-broker-pro',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/intro',
              },
              {
                label: 'API Reference',
                to: '/docs/api-reference',
              },
              {
                label: 'Tutorials',
                to: '/docs/tutorials',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/mortgage-broker-pro',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/mortgage-broker-pro',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/mortgagebrokerpro',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/mortgage-broker-pro',
              },
              {
                label: 'Status',
                href: 'https://status.mortgagebroker.pro',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Mortgage Broker Pro. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['bash', 'json', 'sql', 'yaml', 'powershell'],
      },
      algolia: {
        // The application ID provided by Algolia
        appId: 'YOUR_APP_ID',
        // Public API key: it is safe to commit it
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'mortgage_broker_pro',
        // Optional: see doc section below
        contextualSearch: true,
        // Optional: Specify domains where the navigation should occur through window.location
        externalUrlRegex: 'external\\.com|domain\\.com',
        // Optional: Replace parts of the item URLs from Algolia.
        replaceSearchResultPathname: {
          from: '/docs/', // or as RegExp: /\/docs\//
          to: '/',
        },
        // Optional: Algolia search parameters
        searchParameters: {},
        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search',
      },
    }),

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],
};

module.exports = config;
