import { getSource, pathToBase, isAbsoluteURL, isAbsolutePath } from './misc/utils';
import fs from 'fs';
import path from 'path';

export default class AppCache {
  constructor(options) {
    const output = options.output || options.directory;

    if (isAbsolutePath(output)) {
      throw new Error(
        'OfflinePlugin: ServiceWorker.output option must be a relative path, ' +
        'but an absolute path was passed'
      );
    }

    this.output = output
      .replace(/^\//, '')
      .replace(/\/$/, '') + '/';
    this.publicPath = options.publicPath;

    this.basePath = null;
    this.location = null;
    this.pathRewrite = null;

    // Tool specific properties
    this.NETWORK = options.NETWORK;
    this.FALLBACK = options.FALLBACK;
    this.name = 'manifest';
    this.caches = options.caches;
    this.events = !!options.events;
    this.disableInstall = options.disableInstall || false;
  }

  addEntry(plugin, compilation, compiler) {
    // no-op
    return Promise.resolve();
  }

  apply(plugin, compilation, compiler) {
    if (!Array.isArray(this.caches)) {
      throw new Error('AppCache caches must be an array');
    }

    const pathRewrite = this.pathRewrite;
    const cache = (this.caches.reduce((result, name) => {
      const cache = plugin.caches[name];
      if (!cache || !cache.length) return result;

      if (result) {
        result = result.concat(cache);
      } else {
        result = cache;
      }

      return result;
    }, null) || []).map(pathRewrite);

    const path = this.output + this.name;
    const manifest = this.getManifestTemplate(cache, plugin);
    const content = this.getPageContent();
    const page = this.getPageTemplate(this.name, content);

    compilation.assets[path + '.appcache'] = getSource(manifest);
    compilation.assets[path + '.html'] = getSource(page);
  }

  getManifestTemplate(cache, plugin) {
    let tag = 'ver:' + plugin.version;

    let FALLBACK = '';
    let NETWORK = '';

    if (this.NETWORK) {
      NETWORK = 'NETWORK:\n' + (Array.isArray(this.NETWORK) ?
        this.NETWORK.join('\n') : this.NETWORK + '');
    }

    if (this.FALLBACK) {
      FALLBACK = 'FALLBACK:\n' + Object.keys(this.FALLBACK).map((path) => {
        return path + ' ' + this.FALLBACK[path];
      }).join('\n');
    }

    return `
      CACHE MANIFEST
      #${ tag }

      CACHE:
      ${ cache.join('\n') }

      ${ NETWORK }

      ${ FALLBACK }
    `.trim().replace(/^      */gm, '');
  }

  getPageTemplate(name, content) {
    return `
      <!doctype html>
      <html manifest="${ name }.appcache">${ content || '' }</html>
    `.trim().replace(/^      */gm, '');
  }

  getPageContent() {
    if (this.events) {
      return fs.readFileSync(path.join(__dirname, '../tpls/appcache-frame.tpl'), 'utf-8');
    } else {
      return '';
    }
  }

  getConfig(plugin) {
    return {
      location: this.location,
      name: this.name,
      events: this.events,
      disableInstall: this.disableInstall
    };
  }
}