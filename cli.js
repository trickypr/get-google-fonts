#!/usr/bin/env node

const yargs = require('yargs')
const GGF = require('./main.js')

let ggf = new GGF()

const args = process.argv

// Default Config
let dc = ggf.getConfig()

yargs
  .scriptName('get-google-fonts')
  .command(
    '$0',
    'Download a font from google fonts',
    (yargs) => {
      yargs
        .option('input', {
          alias: 'i',
          type: 'url',
          describe: 'Input URL of CSS with fonts',
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          default: dc.outputDir,
          description: 'Output directory',
        })
        .option('path', {
          alias: 'p',
          type: 'string',
          default: dc.path,
          desc: 'Path placed before every source of font in CSS',
        })
        .option('css', {
          alias: 'c',
          desc: 'Name of CSS file',
          default: dc.cssFile,
          type: 'string',
        })
        .option('template', {
          alias: 't',
          desc: 'Template of font filename',
          type: 'string',
          default: dc.template,
        })
        .option('useragent', {
          alias: 'u',
          desc: 'Template of font filename',
          type: 'string',
          default: dc.template,
        })
        .option('quiet', {
          alias: 'q',
          desc: "Don't displays a lot of useful information",
          type: 'string',
          default: false,
        })
        .option('base64', {
          alias: 'b',
          desc: 'Save fonts inside CSS file as base64 URIs',
        })
        .option('non-strict-ssl', {
          desc:
            'Force to accepts only valid SSL certificates; in some cases, ' +
            'such proxy or self-signed certificates should be turned off',
        })
        .option('overwriting', {
          alias: 'w',
          desc: 'Allows overwrite existing files',
        })
        .option('print-options', {
          desc: 'Shows result options object without performing any action',
        })
        .option('simulate', {
          alias: 's',
          desc: 'Simulation; No file will be saved',
        })
    },
    (res) => {
      const options = {
        outputDir: res.output,
        path: res.path,
        cssFile: res.css,
        userAgent: res.useragent || dc.userAgent,
        verbose: !Boolean(res.quiet),
        overwriting: Boolean(res.overwriting),
        strictSSL: !Boolean(res['non-strict-ssl']),
        base64: Boolean(res.base64),
        simulate: Boolean(res.simulate),
        template: res.template,
      }

      if (Boolean(res['print-options'])) {
        console.log(options)
        return
      }

      if (!res.input) {
        console.error(
          'Error: please provide a URL. Run --help for a list of options'
        )
        return
      }

      ggf
        .download(res.input, {
          outputDir: res.output,
          path: res.path,
          cssFile: res.css,
          userAgent: res.useragent || dc.userAgent,
          verbose: !Boolean(res.quiet),
          overwriting: Boolean(res.overwriting),
          strictSSL: !Boolean(res['non-strict-ssl']),
          base64: Boolean(res.base64),
          simulate: Boolean(res.simulate),
          template: res.template,
        })
        .catch((e) => {
          console.error(e)
        })
    }
  )
  .help().argv
