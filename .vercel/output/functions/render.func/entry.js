import * as adapter from '@astrojs/vercel/serverless/entrypoint';
import { escape } from 'html-escaper';
/* empty css                        */import { optimize } from 'svgo';
import * as Image from '@11ty/eleventy-img';
import Image__default from '@11ty/eleventy-img';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import { readFileSync, mkdir, writeFile } from 'fs';
import 'mime';
import 'kleur/colors';
import 'string-width';
import 'path-browserify';
import { compile } from 'path-to-regexp';

const ASTRO_VERSION = "1.2.1";
function createDeprecatedFetchContentFn() {
  return () => {
    throw new Error("Deprecated: Astro.fetchContent() has been replaced with Astro.glob().");
  };
}
function createAstroGlobFn() {
  const globHandler = (importMetaGlobResult, globValue) => {
    let allEntries = [...Object.values(importMetaGlobResult)];
    if (allEntries.length === 0) {
      throw new Error(`Astro.glob(${JSON.stringify(globValue())}) - no matches found.`);
    }
    return Promise.all(allEntries.map((fn) => fn()));
  };
  return globHandler;
}
function createAstro(filePathname, _site, projectRootStr) {
  const site = _site ? new URL(_site) : void 0;
  const referenceURL = new URL(filePathname, `http://localhost`);
  const projectRoot = new URL(projectRootStr);
  return {
    site,
    generator: `Astro v${ASTRO_VERSION}`,
    fetchContent: createDeprecatedFetchContentFn(),
    glob: createAstroGlobFn(),
    resolve(...segments) {
      let resolved = segments.reduce((u, segment) => new URL(segment, u), referenceURL).pathname;
      if (resolved.startsWith(projectRoot.pathname)) {
        resolved = "/" + resolved.slice(projectRoot.pathname.length);
      }
      return resolved;
    }
  };
}

const escapeHTML = escape;
class HTMLString extends String {
}
const markHTMLString = (value) => {
  if (value instanceof HTMLString) {
    return value;
  }
  if (typeof value === "string") {
    return new HTMLString(value);
  }
  return value;
};

class Metadata {
  constructor(filePathname, opts) {
    this.modules = opts.modules;
    this.hoisted = opts.hoisted;
    this.hydratedComponents = opts.hydratedComponents;
    this.clientOnlyComponents = opts.clientOnlyComponents;
    this.hydrationDirectives = opts.hydrationDirectives;
    this.mockURL = new URL(filePathname, "http://example.com");
    this.metadataCache = /* @__PURE__ */ new Map();
  }
  resolvePath(specifier) {
    if (specifier.startsWith(".")) {
      const resolved = new URL(specifier, this.mockURL).pathname;
      if (resolved.startsWith("/@fs") && resolved.endsWith(".jsx")) {
        return resolved.slice(0, resolved.length - 4);
      }
      return resolved;
    }
    return specifier;
  }
  getPath(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentUrl) || null;
  }
  getExport(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentExport) || null;
  }
  getComponentMetadata(Component) {
    if (this.metadataCache.has(Component)) {
      return this.metadataCache.get(Component);
    }
    const metadata = this.findComponentMetadata(Component);
    this.metadataCache.set(Component, metadata);
    return metadata;
  }
  findComponentMetadata(Component) {
    const isCustomElement = typeof Component === "string";
    for (const { module, specifier } of this.modules) {
      const id = this.resolvePath(specifier);
      for (const [key, value] of Object.entries(module)) {
        if (isCustomElement) {
          if (key === "tagName" && Component === value) {
            return {
              componentExport: key,
              componentUrl: id
            };
          }
        } else if (Component === value) {
          return {
            componentExport: key,
            componentUrl: id
          };
        }
      }
    }
    return null;
  }
}
function createMetadata(filePathname, options) {
  return new Metadata(filePathname, options);
}

const PROP_TYPE = {
  Value: 0,
  JSON: 1,
  RegExp: 2,
  Date: 3,
  Map: 4,
  Set: 5,
  BigInt: 6,
  URL: 7
};
function serializeArray(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = value.map((v) => {
    return convertToSerializedForm(v, metadata, parents);
  });
  parents.delete(value);
  return serialized;
}
function serializeObject(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      return [k, convertToSerializedForm(v, metadata, parents)];
    })
  );
  parents.delete(value);
  return serialized;
}
function convertToSerializedForm(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  const tag = Object.prototype.toString.call(value);
  switch (tag) {
    case "[object Date]": {
      return [PROP_TYPE.Date, value.toISOString()];
    }
    case "[object RegExp]": {
      return [PROP_TYPE.RegExp, value.source];
    }
    case "[object Map]": {
      return [
        PROP_TYPE.Map,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object Set]": {
      return [
        PROP_TYPE.Set,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object BigInt]": {
      return [PROP_TYPE.BigInt, value.toString()];
    }
    case "[object URL]": {
      return [PROP_TYPE.URL, value.toString()];
    }
    case "[object Array]": {
      return [PROP_TYPE.JSON, JSON.stringify(serializeArray(value, metadata, parents))];
    }
    default: {
      if (value !== null && typeof value === "object") {
        return [PROP_TYPE.Value, serializeObject(value, metadata, parents)];
      } else {
        return [PROP_TYPE.Value, value];
      }
    }
  }
}
function serializeProps(props, metadata) {
  const serialized = JSON.stringify(serializeObject(props, metadata));
  return serialized;
}

function serializeListValue(value) {
  const hash = {};
  push(value);
  return Object.keys(hash).join(" ");
  function push(item) {
    if (item && typeof item.forEach === "function")
      item.forEach(push);
    else if (item === Object(item))
      Object.keys(item).forEach((name) => {
        if (item[name])
          push(name);
      });
    else {
      item = item === false || item == null ? "" : String(item).trim();
      if (item) {
        item.split(/\s+/).forEach((name) => {
          hash[name] = true;
        });
      }
    }
  }
}

const HydrationDirectivesRaw = ["load", "idle", "media", "visible", "only"];
const HydrationDirectives = new Set(HydrationDirectivesRaw);
const HydrationDirectiveProps = new Set(HydrationDirectivesRaw.map((n) => `client:${n}`));
function extractDirectives(inputProps) {
  let extracted = {
    isPage: false,
    hydration: null,
    props: {}
  };
  for (const [key, value] of Object.entries(inputProps)) {
    if (key.startsWith("server:")) {
      if (key === "server:root") {
        extracted.isPage = true;
      }
    }
    if (key.startsWith("client:")) {
      if (!extracted.hydration) {
        extracted.hydration = {
          directive: "",
          value: "",
          componentUrl: "",
          componentExport: { value: "" }
        };
      }
      switch (key) {
        case "client:component-path": {
          extracted.hydration.componentUrl = value;
          break;
        }
        case "client:component-export": {
          extracted.hydration.componentExport.value = value;
          break;
        }
        case "client:component-hydration": {
          break;
        }
        case "client:display-name": {
          break;
        }
        default: {
          extracted.hydration.directive = key.split(":")[1];
          extracted.hydration.value = value;
          if (!HydrationDirectives.has(extracted.hydration.directive)) {
            throw new Error(
              `Error: invalid hydration directive "${key}". Supported hydration methods: ${Array.from(
                HydrationDirectiveProps
              ).join(", ")}`
            );
          }
          if (extracted.hydration.directive === "media" && typeof extracted.hydration.value !== "string") {
            throw new Error(
              'Error: Media query must be provided for "client:media", similar to client:media="(max-width: 600px)"'
            );
          }
          break;
        }
      }
    } else if (key === "class:list") {
      extracted.props[key.slice(0, -5)] = serializeListValue(value);
    } else {
      extracted.props[key] = value;
    }
  }
  return extracted;
}
async function generateHydrateScript(scriptOptions, metadata) {
  const { renderer, result, astroId, props, attrs } = scriptOptions;
  const { hydrate, componentUrl, componentExport } = metadata;
  if (!componentExport.value) {
    throw new Error(
      `Unable to resolve a valid export for "${metadata.displayName}"! Please open an issue at https://astro.build/issues!`
    );
  }
  const island = {
    children: "",
    props: {
      uid: astroId
    }
  };
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      island.props[key] = value;
    }
  }
  island.props["component-url"] = await result.resolve(decodeURI(componentUrl));
  if (renderer.clientEntrypoint) {
    island.props["component-export"] = componentExport.value;
    island.props["renderer-url"] = await result.resolve(decodeURI(renderer.clientEntrypoint));
    island.props["props"] = escapeHTML(serializeProps(props, metadata));
  }
  island.props["ssr"] = "";
  island.props["client"] = hydrate;
  island.props["before-hydration-url"] = await result.resolve("astro:scripts/before-hydration.js");
  island.props["opts"] = escapeHTML(
    JSON.stringify({
      name: metadata.displayName,
      value: metadata.hydrateArgs || ""
    })
  );
  return island;
}

var idle_prebuilt_default = `(self.Astro=self.Astro||{}).idle=t=>{const e=async()=>{await(await t())()};"requestIdleCallback"in window?window.requestIdleCallback(e):setTimeout(e,200)},window.dispatchEvent(new Event("astro:idle"));`;

var load_prebuilt_default = `(self.Astro=self.Astro||{}).load=a=>{(async()=>await(await a())())()},window.dispatchEvent(new Event("astro:load"));`;

var media_prebuilt_default = `(self.Astro=self.Astro||{}).media=(s,a)=>{const t=async()=>{await(await s())()};if(a.value){const e=matchMedia(a.value);e.matches?t():e.addEventListener("change",t,{once:!0})}},window.dispatchEvent(new Event("astro:media"));`;

var only_prebuilt_default = `(self.Astro=self.Astro||{}).only=t=>{(async()=>await(await t())())()},window.dispatchEvent(new Event("astro:only"));`;

var visible_prebuilt_default = `(self.Astro=self.Astro||{}).visible=(s,c,n)=>{const r=async()=>{await(await s())()};let i=new IntersectionObserver(e=>{for(const t of e)if(!!t.isIntersecting){i.disconnect(),r();break}});for(let e=0;e<n.children.length;e++){const t=n.children[e];i.observe(t)}},window.dispatchEvent(new Event("astro:visible"));`;

var astro_island_prebuilt_default = `var l;{const c={0:t=>t,1:t=>JSON.parse(t,o),2:t=>new RegExp(t),3:t=>new Date(t),4:t=>new Map(JSON.parse(t,o)),5:t=>new Set(JSON.parse(t,o)),6:t=>BigInt(t),7:t=>new URL(t)},o=(t,i)=>{if(t===""||!Array.isArray(i))return i;const[e,n]=i;return e in c?c[e](n):void 0};customElements.get("astro-island")||customElements.define("astro-island",(l=class extends HTMLElement{constructor(){super(...arguments);this.hydrate=()=>{if(!this.hydrator||this.parentElement&&this.parentElement.closest("astro-island[ssr]"))return;const i=this.querySelectorAll("astro-slot"),e={},n=this.querySelectorAll("template[data-astro-template]");for(const s of n){const r=s.closest(this.tagName);!r||!r.isSameNode(this)||(e[s.getAttribute("data-astro-template")||"default"]=s.innerHTML,s.remove())}for(const s of i){const r=s.closest(this.tagName);!r||!r.isSameNode(this)||(e[s.getAttribute("name")||"default"]=s.innerHTML)}const a=this.hasAttribute("props")?JSON.parse(this.getAttribute("props"),o):{};this.hydrator(this)(this.Component,a,e,{client:this.getAttribute("client")}),this.removeAttribute("ssr"),window.removeEventListener("astro:hydrate",this.hydrate),window.dispatchEvent(new CustomEvent("astro:hydrate"))}}connectedCallback(){!this.hasAttribute("await-children")||this.firstChild?this.childrenConnectedCallback():new MutationObserver((i,e)=>{e.disconnect(),this.childrenConnectedCallback()}).observe(this,{childList:!0})}async childrenConnectedCallback(){window.addEventListener("astro:hydrate",this.hydrate),await import(this.getAttribute("before-hydration-url")),this.start()}start(){const i=JSON.parse(this.getAttribute("opts")),e=this.getAttribute("client");if(Astro[e]===void 0){window.addEventListener(\`astro:\${e}\`,()=>this.start(),{once:!0});return}Astro[e](async()=>{const n=this.getAttribute("renderer-url"),[a,{default:s}]=await Promise.all([import(this.getAttribute("component-url")),n?import(n):()=>()=>{}]),r=this.getAttribute("component-export")||"default";if(!r.includes("."))this.Component=a[r];else{this.Component=a;for(const d of r.split("."))this.Component=this.Component[d]}return this.hydrator=s,this.hydrate},i,this)}attributeChangedCallback(){this.hydrator&&this.hydrate()}},l.observedAttributes=["props"],l))}`;

function determineIfNeedsHydrationScript(result) {
  if (result._metadata.hasHydrationScript) {
    return false;
  }
  return result._metadata.hasHydrationScript = true;
}
const hydrationScripts = {
  idle: idle_prebuilt_default,
  load: load_prebuilt_default,
  only: only_prebuilt_default,
  media: media_prebuilt_default,
  visible: visible_prebuilt_default
};
function determinesIfNeedsDirectiveScript(result, directive) {
  if (result._metadata.hasDirectives.has(directive)) {
    return false;
  }
  result._metadata.hasDirectives.add(directive);
  return true;
}
function getDirectiveScriptText(directive) {
  if (!(directive in hydrationScripts)) {
    throw new Error(`Unknown directive: ${directive}`);
  }
  const directiveScriptText = hydrationScripts[directive];
  return directiveScriptText;
}
function getPrescripts(type, directive) {
  switch (type) {
    case "both":
      return `<style>astro-island,astro-slot{display:contents}</style><script>${getDirectiveScriptText(directive) + astro_island_prebuilt_default}<\/script>`;
    case "directive":
      return `<script>${getDirectiveScriptText(directive)}<\/script>`;
  }
  return "";
}

const Fragment = Symbol.for("astro:fragment");
const Renderer = Symbol.for("astro:renderer");
function stringifyChunk(result, chunk) {
  switch (chunk.type) {
    case "directive": {
      const { hydration } = chunk;
      let needsHydrationScript = hydration && determineIfNeedsHydrationScript(result);
      let needsDirectiveScript = hydration && determinesIfNeedsDirectiveScript(result, hydration.directive);
      let prescriptType = needsHydrationScript ? "both" : needsDirectiveScript ? "directive" : null;
      if (prescriptType) {
        let prescripts = getPrescripts(prescriptType, hydration.directive);
        return markHTMLString(prescripts);
      } else {
        return "";
      }
    }
    default: {
      return chunk.toString();
    }
  }
}

function validateComponentProps(props, displayName) {
  var _a;
  if (((_a = (Object.assign({"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true},{_:process.env._,}))) == null ? void 0 : _a.DEV) && props != null) {
    for (const prop of Object.keys(props)) {
      if (HydrationDirectiveProps.has(prop)) {
        console.warn(
          `You are attempting to render <${displayName} ${prop} />, but ${displayName} is an Astro component. Astro components do not render in the client and should not have a hydration directive. Please use a framework component for client rendering.`
        );
      }
    }
  }
}
class AstroComponent {
  constructor(htmlParts, expressions) {
    this.htmlParts = htmlParts;
    this.expressions = expressions;
  }
  get [Symbol.toStringTag]() {
    return "AstroComponent";
  }
  async *[Symbol.asyncIterator]() {
    const { htmlParts, expressions } = this;
    for (let i = 0; i < htmlParts.length; i++) {
      const html = htmlParts[i];
      const expression = expressions[i];
      yield markHTMLString(html);
      yield* renderChild(expression);
    }
  }
}
function isAstroComponent(obj) {
  return typeof obj === "object" && Object.prototype.toString.call(obj) === "[object AstroComponent]";
}
function isAstroComponentFactory(obj) {
  return obj == null ? false : !!obj.isAstroComponentFactory;
}
async function* renderAstroComponent(component) {
  for await (const value of component) {
    if (value || value === 0) {
      for await (const chunk of renderChild(value)) {
        switch (chunk.type) {
          case "directive": {
            yield chunk;
            break;
          }
          default: {
            yield markHTMLString(chunk);
            break;
          }
        }
      }
    }
  }
}
async function renderToString(result, componentFactory, props, children) {
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    const response = Component;
    throw response;
  }
  let html = "";
  for await (const chunk of renderAstroComponent(Component)) {
    html += stringifyChunk(result, chunk);
  }
  return html;
}
async function renderToIterable(result, componentFactory, displayName, props, children) {
  validateComponentProps(props, displayName);
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    console.warn(
      `Returning a Response is only supported inside of page components. Consider refactoring this logic into something like a function that can be used in the page.`
    );
    const response = Component;
    throw response;
  }
  return renderAstroComponent(Component);
}
async function renderTemplate(htmlParts, ...expressions) {
  return new AstroComponent(htmlParts, expressions);
}

async function* renderChild(child) {
  child = await child;
  if (child instanceof HTMLString) {
    yield child;
  } else if (Array.isArray(child)) {
    for (const value of child) {
      yield markHTMLString(await renderChild(value));
    }
  } else if (typeof child === "function") {
    yield* renderChild(child());
  } else if (typeof child === "string") {
    yield markHTMLString(escapeHTML(child));
  } else if (!child && child !== 0) ; else if (child instanceof AstroComponent || Object.prototype.toString.call(child) === "[object AstroComponent]") {
    yield* renderAstroComponent(child);
  } else if (typeof child === "object" && Symbol.asyncIterator in child) {
    yield* child;
  } else {
    yield child;
  }
}
async function renderSlot(result, slotted, fallback) {
  if (slotted) {
    let iterator = renderChild(slotted);
    let content = "";
    for await (const chunk of iterator) {
      if (chunk.type === "directive") {
        content += stringifyChunk(result, chunk);
      } else {
        content += chunk;
      }
    }
    return markHTMLString(content);
  }
  return fallback;
}

/**
 * shortdash - https://github.com/bibig/node-shorthash
 *
 * @license
 *
 * (The MIT License)
 *
 * Copyright (c) 2013 Bibig <bibig@me.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
const dictionary = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY";
const binary = dictionary.length;
function bitwise(str) {
  let hash = 0;
  if (str.length === 0)
    return hash;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash = hash & hash;
  }
  return hash;
}
function shorthash(text) {
  let num;
  let result = "";
  let integer = bitwise(text);
  const sign = integer < 0 ? "Z" : "";
  integer = Math.abs(integer);
  while (integer >= binary) {
    num = integer % binary;
    integer = Math.floor(integer / binary);
    result = dictionary[num] + result;
  }
  if (integer > 0) {
    result = dictionary[integer] + result;
  }
  return sign + result;
}

const voidElementNames = /^(area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i;
const htmlBooleanAttributes = /^(allowfullscreen|async|autofocus|autoplay|controls|default|defer|disabled|disablepictureinpicture|disableremoteplayback|formnovalidate|hidden|loop|nomodule|novalidate|open|playsinline|readonly|required|reversed|scoped|seamless|itemscope)$/i;
const htmlEnumAttributes = /^(contenteditable|draggable|spellcheck|value)$/i;
const svgEnumAttributes = /^(autoReverse|externalResourcesRequired|focusable|preserveAlpha)$/i;
const STATIC_DIRECTIVES = /* @__PURE__ */ new Set(["set:html", "set:text"]);
const toIdent = (k) => k.trim().replace(/(?:(?<!^)\b\w|\s+|[^\w]+)/g, (match, index) => {
  if (/[^\w]|\s/.test(match))
    return "";
  return index === 0 ? match : match.toUpperCase();
});
const toAttributeString = (value, shouldEscape = true) => shouldEscape ? String(value).replace(/&/g, "&#38;").replace(/"/g, "&#34;") : value;
const kebab = (k) => k.toLowerCase() === k ? k : k.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const toStyleString = (obj) => Object.entries(obj).map(([k, v]) => `${kebab(k)}:${v}`).join(";");
function defineScriptVars(vars) {
  let output = "";
  for (const [key, value] of Object.entries(vars)) {
    output += `let ${toIdent(key)} = ${JSON.stringify(value)};
`;
  }
  return markHTMLString(output);
}
function formatList(values) {
  if (values.length === 1) {
    return values[0];
  }
  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}
function addAttribute(value, key, shouldEscape = true) {
  if (value == null) {
    return "";
  }
  if (value === false) {
    if (htmlEnumAttributes.test(key) || svgEnumAttributes.test(key)) {
      return markHTMLString(` ${key}="false"`);
    }
    return "";
  }
  if (STATIC_DIRECTIVES.has(key)) {
    console.warn(`[astro] The "${key}" directive cannot be applied dynamically at runtime. It will not be rendered as an attribute.

Make sure to use the static attribute syntax (\`${key}={value}\`) instead of the dynamic spread syntax (\`{...{ "${key}": value }}\`).`);
    return "";
  }
  if (key === "class:list") {
    const listValue = toAttributeString(serializeListValue(value));
    if (listValue === "") {
      return "";
    }
    return markHTMLString(` ${key.slice(0, -5)}="${listValue}"`);
  }
  if (key === "style" && !(value instanceof HTMLString) && typeof value === "object") {
    return markHTMLString(` ${key}="${toStyleString(value)}"`);
  }
  if (key === "className") {
    return markHTMLString(` class="${toAttributeString(value, shouldEscape)}"`);
  }
  if (value === true && (key.startsWith("data-") || htmlBooleanAttributes.test(key))) {
    return markHTMLString(` ${key}`);
  } else {
    return markHTMLString(` ${key}="${toAttributeString(value, shouldEscape)}"`);
  }
}
function internalSpreadAttributes(values, shouldEscape = true) {
  let output = "";
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, shouldEscape);
  }
  return markHTMLString(output);
}
function renderElement$1(name, { props: _props, children = "" }, shouldEscape = true) {
  const { lang: _, "data-astro-id": astroId, "define:vars": defineVars, ...props } = _props;
  if (defineVars) {
    if (name === "style") {
      delete props["is:global"];
      delete props["is:scoped"];
    }
    if (name === "script") {
      delete props.hoist;
      children = defineScriptVars(defineVars) + "\n" + children;
    }
  }
  if ((children == null || children == "") && voidElementNames.test(name)) {
    return `<${name}${internalSpreadAttributes(props, shouldEscape)} />`;
  }
  return `<${name}${internalSpreadAttributes(props, shouldEscape)}>${children}</${name}>`;
}

function componentIsHTMLElement(Component) {
  return typeof HTMLElement !== "undefined" && HTMLElement.isPrototypeOf(Component);
}
async function renderHTMLElement(result, constructor, props, slots) {
  const name = getHTMLElementName(constructor);
  let attrHTML = "";
  for (const attr in props) {
    attrHTML += ` ${attr}="${toAttributeString(await props[attr])}"`;
  }
  return markHTMLString(
    `<${name}${attrHTML}>${await renderSlot(result, slots == null ? void 0 : slots.default)}</${name}>`
  );
}
function getHTMLElementName(constructor) {
  const definedName = customElements.getName(constructor);
  if (definedName)
    return definedName;
  const assignedName = constructor.name.replace(/^HTML|Element$/g, "").replace(/[A-Z]/g, "-$&").toLowerCase().replace(/^-/, "html-");
  return assignedName;
}

const rendererAliases = /* @__PURE__ */ new Map([["solid", "solid-js"]]);
function guessRenderers(componentUrl) {
  const extname = componentUrl == null ? void 0 : componentUrl.split(".").pop();
  switch (extname) {
    case "svelte":
      return ["@astrojs/svelte"];
    case "vue":
      return ["@astrojs/vue"];
    case "jsx":
    case "tsx":
      return ["@astrojs/react", "@astrojs/preact"];
    default:
      return ["@astrojs/react", "@astrojs/preact", "@astrojs/vue", "@astrojs/svelte"];
  }
}
function getComponentType(Component) {
  if (Component === Fragment) {
    return "fragment";
  }
  if (Component && typeof Component === "object" && Component["astro:html"]) {
    return "html";
  }
  if (isAstroComponentFactory(Component)) {
    return "astro-factory";
  }
  return "unknown";
}
async function renderComponent(result, displayName, Component, _props, slots = {}) {
  var _a;
  Component = await Component;
  switch (getComponentType(Component)) {
    case "fragment": {
      const children2 = await renderSlot(result, slots == null ? void 0 : slots.default);
      if (children2 == null) {
        return children2;
      }
      return markHTMLString(children2);
    }
    case "html": {
      const children2 = {};
      if (slots) {
        await Promise.all(
          Object.entries(slots).map(
            ([key, value]) => renderSlot(result, value).then((output) => {
              children2[key] = output;
            })
          )
        );
      }
      const html2 = Component.render({ slots: children2 });
      return markHTMLString(html2);
    }
    case "astro-factory": {
      async function* renderAstroComponentInline() {
        let iterable = await renderToIterable(result, Component, displayName, _props, slots);
        yield* iterable;
      }
      return renderAstroComponentInline();
    }
  }
  if (!Component && !_props["client:only"]) {
    throw new Error(
      `Unable to render ${displayName} because it is ${Component}!
Did you forget to import the component or is it possible there is a typo?`
    );
  }
  const { renderers } = result._metadata;
  const metadata = { displayName };
  const { hydration, isPage, props } = extractDirectives(_props);
  let html = "";
  let attrs = void 0;
  if (hydration) {
    metadata.hydrate = hydration.directive;
    metadata.hydrateArgs = hydration.value;
    metadata.componentExport = hydration.componentExport;
    metadata.componentUrl = hydration.componentUrl;
  }
  const probableRendererNames = guessRenderers(metadata.componentUrl);
  if (Array.isArray(renderers) && renderers.length === 0 && typeof Component !== "string" && !componentIsHTMLElement(Component)) {
    const message = `Unable to render ${metadata.displayName}!

There are no \`integrations\` set in your \`astro.config.mjs\` file.
Did you mean to add ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`;
    throw new Error(message);
  }
  const children = {};
  if (slots) {
    await Promise.all(
      Object.entries(slots).map(
        ([key, value]) => renderSlot(result, value).then((output) => {
          children[key] = output;
        })
      )
    );
  }
  let renderer;
  if (metadata.hydrate !== "only") {
    if (Component && Component[Renderer]) {
      const rendererName = Component[Renderer];
      renderer = renderers.find(({ name }) => name === rendererName);
    }
    if (!renderer) {
      let error;
      for (const r of renderers) {
        try {
          if (await r.ssr.check.call({ result }, Component, props, children)) {
            renderer = r;
            break;
          }
        } catch (e) {
          error ?? (error = e);
        }
      }
      if (!renderer && error) {
        throw error;
      }
    }
    if (!renderer && typeof HTMLElement === "function" && componentIsHTMLElement(Component)) {
      const output = renderHTMLElement(result, Component, _props, slots);
      return output;
    }
  } else {
    if (metadata.hydrateArgs) {
      const passedName = metadata.hydrateArgs;
      const rendererName = rendererAliases.has(passedName) ? rendererAliases.get(passedName) : passedName;
      renderer = renderers.find(
        ({ name }) => name === `@astrojs/${rendererName}` || name === rendererName
      );
    }
    if (!renderer && renderers.length === 1) {
      renderer = renderers[0];
    }
    if (!renderer) {
      const extname = (_a = metadata.componentUrl) == null ? void 0 : _a.split(".").pop();
      renderer = renderers.filter(
        ({ name }) => name === `@astrojs/${extname}` || name === extname
      )[0];
    }
  }
  if (!renderer) {
    if (metadata.hydrate === "only") {
      throw new Error(`Unable to render ${metadata.displayName}!

Using the \`client:only\` hydration strategy, Astro needs a hint to use the correct renderer.
Did you mean to pass <${metadata.displayName} client:only="${probableRendererNames.map((r) => r.replace("@astrojs/", "")).join("|")}" />
`);
    } else if (typeof Component !== "string") {
      const matchingRenderers = renderers.filter((r) => probableRendererNames.includes(r.name));
      const plural = renderers.length > 1;
      if (matchingRenderers.length === 0) {
        throw new Error(`Unable to render ${metadata.displayName}!

There ${plural ? "are" : "is"} ${renderers.length} renderer${plural ? "s" : ""} configured in your \`astro.config.mjs\` file,
but ${plural ? "none were" : "it was not"} able to server-side render ${metadata.displayName}.

Did you mean to enable ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`);
      } else if (matchingRenderers.length === 1) {
        renderer = matchingRenderers[0];
        ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
          { result },
          Component,
          props,
          children,
          metadata
        ));
      } else {
        throw new Error(`Unable to render ${metadata.displayName}!

This component likely uses ${formatList(probableRendererNames)},
but Astro encountered an error during server-side rendering.

Please ensure that ${metadata.displayName}:
1. Does not unconditionally access browser-specific globals like \`window\` or \`document\`.
   If this is unavoidable, use the \`client:only\` hydration directive.
2. Does not conditionally return \`null\` or \`undefined\` when rendered on the server.

If you're still stuck, please open an issue on GitHub or join us at https://astro.build/chat.`);
      }
    }
  } else {
    if (metadata.hydrate === "only") {
      html = await renderSlot(result, slots == null ? void 0 : slots.fallback);
    } else {
      ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
        { result },
        Component,
        props,
        children,
        metadata
      ));
    }
  }
  if (renderer && !renderer.clientEntrypoint && renderer.name !== "@astrojs/lit" && metadata.hydrate) {
    throw new Error(
      `${metadata.displayName} component has a \`client:${metadata.hydrate}\` directive, but no client entrypoint was provided by ${renderer.name}!`
    );
  }
  if (!html && typeof Component === "string") {
    const childSlots = Object.values(children).join("");
    const iterable = renderAstroComponent(
      await renderTemplate`<${Component}${internalSpreadAttributes(props)}${markHTMLString(
        childSlots === "" && voidElementNames.test(Component) ? `/>` : `>${childSlots}</${Component}>`
      )}`
    );
    html = "";
    for await (const chunk of iterable) {
      html += chunk;
    }
  }
  if (!hydration) {
    if (isPage || (renderer == null ? void 0 : renderer.name) === "astro:jsx") {
      return html;
    }
    return markHTMLString(html.replace(/\<\/?astro-slot\>/g, ""));
  }
  const astroId = shorthash(
    `<!--${metadata.componentExport.value}:${metadata.componentUrl}-->
${html}
${serializeProps(
      props,
      metadata
    )}`
  );
  const island = await generateHydrateScript(
    { renderer, result, astroId, props, attrs },
    metadata
  );
  let unrenderedSlots = [];
  if (html) {
    if (Object.keys(children).length > 0) {
      for (const key of Object.keys(children)) {
        if (!html.includes(key === "default" ? `<astro-slot>` : `<astro-slot name="${key}">`)) {
          unrenderedSlots.push(key);
        }
      }
    }
  } else {
    unrenderedSlots = Object.keys(children);
  }
  const template = unrenderedSlots.length > 0 ? unrenderedSlots.map(
    (key) => `<template data-astro-template${key !== "default" ? `="${key}"` : ""}>${children[key]}</template>`
  ).join("") : "";
  island.children = `${html ?? ""}${template}`;
  if (island.children) {
    island.props["await-children"] = "";
  }
  async function* renderAll() {
    yield { type: "directive", hydration, result };
    yield markHTMLString(renderElement$1("astro-island", island, false));
  }
  return renderAll();
}

const uniqueElements = (item, index, all) => {
  const props = JSON.stringify(item.props);
  const children = item.children;
  return index === all.findIndex((i) => JSON.stringify(i.props) === props && i.children == children);
};
const alreadyHeadRenderedResults = /* @__PURE__ */ new WeakSet();
function renderHead(result) {
  alreadyHeadRenderedResults.add(result);
  const styles = Array.from(result.styles).filter(uniqueElements).map((style) => renderElement$1("style", style));
  result.styles.clear();
  const scripts = Array.from(result.scripts).filter(uniqueElements).map((script, i) => {
    return renderElement$1("script", script, false);
  });
  const links = Array.from(result.links).filter(uniqueElements).map((link) => renderElement$1("link", link, false));
  return markHTMLString(links.join("\n") + styles.join("\n") + scripts.join("\n"));
}
async function* maybeRenderHead(result) {
  if (alreadyHeadRenderedResults.has(result)) {
    return;
  }
  yield renderHead(result);
}

typeof process === "object" && Object.prototype.toString.call(process) === "[object process]";

new TextEncoder();

function createComponent(cb) {
  cb.isAstroComponentFactory = true;
  return cb;
}
function spreadAttributes(values, _name, { class: scopedClassName } = {}) {
  let output = "";
  if (scopedClassName) {
    if (typeof values.class !== "undefined") {
      values.class += ` ${scopedClassName}`;
    } else if (typeof values["class:list"] !== "undefined") {
      values["class:list"] = [values["class:list"], scopedClassName];
    } else {
      values.class = scopedClassName;
    }
  }
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, true);
  }
  return markHTMLString(output);
}

const AstroJSX = "astro:jsx";
const Empty = Symbol("empty");
const toSlotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
function isVNode(vnode) {
  return vnode && typeof vnode === "object" && vnode[AstroJSX];
}
function transformSlots(vnode) {
  if (typeof vnode.type === "string")
    return vnode;
  const slots = {};
  if (isVNode(vnode.props.children)) {
    const child = vnode.props.children;
    if (!isVNode(child))
      return;
    if (!("slot" in child.props))
      return;
    const name = toSlotName(child.props.slot);
    slots[name] = [child];
    slots[name]["$$slot"] = true;
    delete child.props.slot;
    delete vnode.props.children;
  }
  if (Array.isArray(vnode.props.children)) {
    vnode.props.children = vnode.props.children.map((child) => {
      if (!isVNode(child))
        return child;
      if (!("slot" in child.props))
        return child;
      const name = toSlotName(child.props.slot);
      if (Array.isArray(slots[name])) {
        slots[name].push(child);
      } else {
        slots[name] = [child];
        slots[name]["$$slot"] = true;
      }
      delete child.props.slot;
      return Empty;
    }).filter((v) => v !== Empty);
  }
  Object.assign(vnode.props, slots);
}
function markRawChildren(child) {
  if (typeof child === "string")
    return markHTMLString(child);
  if (Array.isArray(child))
    return child.map((c) => markRawChildren(c));
  return child;
}
function transformSetDirectives(vnode) {
  if (!("set:html" in vnode.props || "set:text" in vnode.props))
    return;
  if ("set:html" in vnode.props) {
    const children = markRawChildren(vnode.props["set:html"]);
    delete vnode.props["set:html"];
    Object.assign(vnode.props, { children });
    return;
  }
  if ("set:text" in vnode.props) {
    const children = vnode.props["set:text"];
    delete vnode.props["set:text"];
    Object.assign(vnode.props, { children });
    return;
  }
}
function createVNode(type, props) {
  const vnode = {
    [AstroJSX]: true,
    type,
    props: props ?? {}
  };
  transformSetDirectives(vnode);
  transformSlots(vnode);
  return vnode;
}

const ClientOnlyPlaceholder = "astro-client-only";
const skipAstroJSXCheck = /* @__PURE__ */ new WeakSet();
let originalConsoleError;
let consoleFilterRefs = 0;
async function renderJSX(result, vnode) {
  switch (true) {
    case vnode instanceof HTMLString:
      if (vnode.toString().trim() === "") {
        return "";
      }
      return vnode;
    case typeof vnode === "string":
      return markHTMLString(escapeHTML(vnode));
    case (!vnode && vnode !== 0):
      return "";
    case Array.isArray(vnode):
      return markHTMLString(
        (await Promise.all(vnode.map((v) => renderJSX(result, v)))).join("")
      );
  }
  if (isVNode(vnode)) {
    switch (true) {
      case vnode.type === Symbol.for("astro:fragment"):
        return renderJSX(result, vnode.props.children);
      case vnode.type.isAstroComponentFactory: {
        let props = {};
        let slots = {};
        for (const [key, value] of Object.entries(vnode.props ?? {})) {
          if (key === "children" || value && typeof value === "object" && value["$$slot"]) {
            slots[key === "children" ? "default" : key] = () => renderJSX(result, value);
          } else {
            props[key] = value;
          }
        }
        return markHTMLString(await renderToString(result, vnode.type, props, slots));
      }
      case (!vnode.type && vnode.type !== 0):
        return "";
      case (typeof vnode.type === "string" && vnode.type !== ClientOnlyPlaceholder):
        return markHTMLString(await renderElement(result, vnode.type, vnode.props ?? {}));
    }
    if (vnode.type) {
      let extractSlots2 = function(child) {
        if (Array.isArray(child)) {
          return child.map((c) => extractSlots2(c));
        }
        if (!isVNode(child)) {
          _slots.default.push(child);
          return;
        }
        if ("slot" in child.props) {
          _slots[child.props.slot] = [..._slots[child.props.slot] ?? [], child];
          delete child.props.slot;
          return;
        }
        _slots.default.push(child);
      };
      if (typeof vnode.type === "function" && vnode.type["astro:renderer"]) {
        skipAstroJSXCheck.add(vnode.type);
      }
      if (typeof vnode.type === "function" && vnode.props["server:root"]) {
        const output2 = await vnode.type(vnode.props ?? {});
        return await renderJSX(result, output2);
      }
      if (typeof vnode.type === "function" && !skipAstroJSXCheck.has(vnode.type)) {
        useConsoleFilter();
        try {
          const output2 = await vnode.type(vnode.props ?? {});
          if (output2 && output2[AstroJSX]) {
            return await renderJSX(result, output2);
          } else if (!output2) {
            return await renderJSX(result, output2);
          }
        } catch (e) {
          skipAstroJSXCheck.add(vnode.type);
        } finally {
          finishUsingConsoleFilter();
        }
      }
      const { children = null, ...props } = vnode.props ?? {};
      const _slots = {
        default: []
      };
      extractSlots2(children);
      for (const [key, value] of Object.entries(props)) {
        if (value["$$slot"]) {
          _slots[key] = value;
          delete props[key];
        }
      }
      const slotPromises = [];
      const slots = {};
      for (const [key, value] of Object.entries(_slots)) {
        slotPromises.push(
          renderJSX(result, value).then((output2) => {
            if (output2.toString().trim().length === 0)
              return;
            slots[key] = () => output2;
          })
        );
      }
      await Promise.all(slotPromises);
      let output;
      if (vnode.type === ClientOnlyPlaceholder && vnode.props["client:only"]) {
        output = await renderComponent(
          result,
          vnode.props["client:display-name"] ?? "",
          null,
          props,
          slots
        );
      } else {
        output = await renderComponent(
          result,
          typeof vnode.type === "function" ? vnode.type.name : vnode.type,
          vnode.type,
          props,
          slots
        );
      }
      if (typeof output !== "string" && Symbol.asyncIterator in output) {
        let body = "";
        for await (const chunk of output) {
          let html = stringifyChunk(result, chunk);
          body += html;
        }
        return markHTMLString(body);
      } else {
        return markHTMLString(output);
      }
    }
  }
  return markHTMLString(`${vnode}`);
}
async function renderElement(result, tag, { children, ...props }) {
  return markHTMLString(
    `<${tag}${spreadAttributes(props)}${markHTMLString(
      (children == null || children == "") && voidElementNames.test(tag) ? `/>` : `>${children == null ? "" : await renderJSX(result, children)}</${tag}>`
    )}`
  );
}
function useConsoleFilter() {
  consoleFilterRefs++;
  if (!originalConsoleError) {
    originalConsoleError = console.error;
    try {
      console.error = filteredConsoleError;
    } catch (error) {
    }
  }
}
function finishUsingConsoleFilter() {
  consoleFilterRefs--;
}
function filteredConsoleError(msg, ...rest) {
  if (consoleFilterRefs > 0 && typeof msg === "string") {
    const isKnownReactHookError = msg.includes("Warning: Invalid hook call.") && msg.includes("https://reactjs.org/link/invalid-hook-call");
    if (isKnownReactHookError)
      return;
  }
}

const slotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
async function check(Component, props, { default: children = null, ...slotted } = {}) {
  if (typeof Component !== "function")
    return false;
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  try {
    const result = await Component({ ...props, ...slots, children });
    return result[AstroJSX];
  } catch (e) {
  }
  return false;
}
async function renderToStaticMarkup(Component, props = {}, { default: children = null, ...slotted } = {}) {
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  const { result } = this;
  const html = await renderJSX(result, createVNode(Component, { ...props, ...slots, children }));
  return { html };
}
var server_default = {
  check,
  renderToStaticMarkup
};

const $$metadata$e = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/content-section.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$i = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/content-section.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$ContentSection = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$i, $$props, $$slots);
  Astro2.self = $$ContentSection;
  const { title, id } = Astro2.props;
  return renderTemplate`${maybeRenderHead($$result)}<section${addAttribute(id, "id")} class="flex flex-col gap-4 space-y-8 scroll-mt-24">
  <div class="flex flex-col gap-4">
    ${renderSlot($$result, $$slots["eyebrow"])}
    <h2 class="text-6xl font-extrabold tracking-tight gradient-text">
      ${title}
    </h2>
  </div>
  <p class="max-w-xl text-2xl font-extrabold">
    ${renderSlot($$result, $$slots["lead"])}
  </p>
  ${renderSlot($$result, $$slots["default"])}
</section>`;
});

const $$file$e = "/Users/jason/Workspace/astro-landing/src/components/content-section.astro";
const $$url$e = undefined;

const $$module1$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$e,
  default: $$ContentSection,
  file: $$file$e,
  url: $$url$e
}, Symbol.toStringTag, { value: 'Module' }));

const __vite_glob_1_0 = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"64\" height=\"64\"><path d=\"M32 24.795c-1.164.296-1.884.013-2.53-.957l-4.594-6.356-.664-.88-5.365 7.257c-.613.873-1.256 1.253-2.4.944l6.87-9.222-6.396-8.33c1.1-.214 1.86-.105 2.535.88l4.765 6.435 4.8-6.4c.615-.873 1.276-1.205 2.38-.883l-2.48 3.288-3.36 4.375c-.4.5-.345.842.023 1.325L32 24.795zM.008 15.427l.562-2.764C2.1 7.193 8.37 4.92 12.694 8.3c2.527 1.988 3.155 4.8 3.03 7.95H1.48c-.214 5.67 3.867 9.092 9.07 7.346 1.825-.613 2.9-2.042 3.438-3.83.273-.896.725-1.036 1.567-.78-.43 2.236-1.4 4.104-3.45 5.273-3.063 1.75-7.435 1.184-9.735-1.248C1 21.6.434 19.812.18 17.9c-.04-.316-.12-.617-.18-.92q.008-.776.008-1.552zm1.498-.38h12.872c-.084-4.1-2.637-7.012-6.126-7.037-3.83-.03-6.58 2.813-6.746 7.037z\"/></svg>";

const __vite_glob_1_1 = "<svg viewBox=\"0 0 627 825\" fill=\"none\">\n  <path\n    fill-rule=\"evenodd\"\n    clip-rule=\"evenodd\"\n    d=\"M445.433 22.9832C452.722 32.0324 456.439 44.2432 463.873 68.6647L626.281 602.176C566.234 571.026 500.957 548.56 432.115 536.439L326.371 179.099C324.641 173.252 319.27 169.241 313.173 169.241C307.06 169.241 301.68 173.273 299.963 179.14L195.5 536.259C126.338 548.325 60.7632 570.832 0.459473 602.095L163.664 68.5412C171.121 44.1617 174.85 31.9718 182.14 22.9393C188.575 14.9651 196.946 8.77213 206.454 4.95048C217.224 0.621582 229.971 0.621582 255.466 0.621582H372.034C397.562 0.621582 410.326 0.621582 421.106 4.95951C430.622 8.78908 438.998 14.9946 445.433 22.9832Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    fill-rule=\"evenodd\"\n    clip-rule=\"evenodd\"\n    d=\"M464.867 627.566C438.094 650.46 384.655 666.073 323.101 666.073C247.551 666.073 184.229 642.553 167.426 610.921C161.419 629.05 160.072 649.798 160.072 663.052C160.072 663.052 156.114 728.134 201.38 773.401C201.38 749.896 220.435 730.842 243.939 730.842C284.226 730.842 284.181 765.99 284.144 794.506C284.143 795.36 284.142 796.209 284.142 797.051C284.142 840.333 310.595 877.436 348.215 893.075C342.596 881.518 339.444 868.54 339.444 854.825C339.444 813.545 363.679 798.175 391.845 780.311C414.255 766.098 439.155 750.307 456.315 718.629C465.268 702.101 470.352 683.17 470.352 663.052C470.352 650.68 468.43 638.757 464.867 627.566Z\"\n    fill=\"#FF5D01\"\n  />\n</svg>\n";

const __vite_glob_1_2 = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg width=\"207px\" height=\"124px\" viewBox=\"0 0 207 124\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n    <!-- Generator: Sketch 51.2 (57519) - http://www.bohemiancoding.com/sketch -->\n    <title>next-black</title>\n    <desc>Created with Sketch.</desc>\n    <defs></defs>\n    <g id=\"Page-1\" stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\">\n        <g id=\"Black-Next.js\" transform=\"translate(-247.000000, -138.000000)\" fill=\"#000000\" fill-rule=\"nonzero\">\n            <g id=\"next-black\" transform=\"translate(247.000000, 138.000000)\">\n                <g id=\"EXT-+-Type-something\">\n                    <path d=\"M48.9421964,32.6320058 L87.9011585,32.6320058 L87.9011585,35.7136421 L52.5134345,35.7136421 L52.5134345,58.9070103 L85.7908813,58.9070103 L85.7908813,61.9886466 L52.5134345,61.9886466 L52.5134345,87.4526941 L88.306981,87.4526941 L88.306981,90.5343303 L48.9421964,90.5343303 L48.9421964,32.6320058 Z M91.3912326,32.6320058 L95.5306221,32.6320058 L113.8738,58.0960534 L132.622801,32.6320058 L158.124498,0.286809811 L116.22757,60.7722112 L137.817329,90.5343303 L133.51561,90.5343303 L113.8738,63.4483691 L94.1508254,90.5343303 L89.9302715,90.5343303 L111.682358,60.7722112 L91.3912326,32.6320058 Z M139.359455,35.713642 L139.359455,32.6320058 L183.756439,32.6320058 L183.756439,35.7136421 L163.302983,35.7136421 L163.302983,90.5343303 L159.731745,90.5343303 L159.731745,35.7136421 L139.359455,35.713642 Z\" id=\"EXT\"></path>\n                    <polygon id=\"Type-something\" points=\"0.202923647 32.6320058 4.66697141 32.6320058 66.2235778 124.303087 40.785176 90.5343303 3.93649086 37.0111732 3.77416185 90.5343303 0.202923647 90.5343303\"></polygon>\n                </g>\n                <path d=\"M183.396622,86.5227221 C184.134938,86.5227221 184.673474,85.9601075 184.673474,85.233037 C184.673474,84.5059658 184.134938,83.9433513 183.396622,83.9433513 C182.666993,83.9433513 182.11977,84.5059658 182.11977,85.233037 C182.11977,85.9601075 182.666993,86.5227221 183.396622,86.5227221 Z M186.905793,83.1297235 C186.905793,85.2763149 188.460599,86.678523 190.727662,86.678523 C193.142388,86.678523 194.601647,85.233037 194.601647,82.7229099 L194.601647,73.8855335 L192.655968,73.8855335 L192.655968,82.7142542 C192.655968,84.1078073 191.952397,84.8521899 190.710289,84.8521899 C189.598473,84.8521899 188.842785,84.1597409 188.816727,83.1297235 L186.905793,83.1297235 Z M197.146664,83.0172011 C197.285642,85.2503478 199.153145,86.678523 201.932686,86.678523 C204.903321,86.678523 206.762139,85.1811034 206.762139,82.792155 C206.762139,80.9138876 205.702439,79.8752151 203.131364,79.2779777 L201.750279,78.9404092 C200.117298,78.5595622 199.457158,78.0488813 199.457158,77.1573541 C199.457158,76.0321243 200.482113,75.296398 202.019547,75.296398 C203.478806,75.296398 204.48639,76.0148135 204.668797,77.1660091 L206.562359,77.1660091 C206.44944,75.0626962 204.590622,73.5825873 202.045605,73.5825873 C199.309495,73.5825873 197.48542,75.0626962 197.48542,77.2871878 C197.48542,79.1221767 198.519063,80.2127835 200.786126,80.7407758 L202.401734,81.1302779 C204.060773,81.5197807 204.790402,82.091051 204.790402,83.0431676 C204.790402,84.1510859 203.643842,84.9560573 202.08035,84.9560573 C200.403939,84.9560573 199.240006,84.2030196 199.074971,83.0172011 L197.146664,83.0172011 Z\" id=\".JS\"></path>\n            </g>\n        </g>\n    </g>\n</svg>";

const __vite_glob_1_3 = "<svg \nxmlns=\"http://www.w3.org/2000/svg\" \nwidth=\"589.827\" \nheight=\"361.238\" \nversion=\"1.2\" \nviewBox=\"0 0 442.37 270.929\">\n<defs><clipPath id=\"a\"><path d=\"M239.03 226.605l-42.13 24.317c-1.578.91-2.546 2.59-2.546 4.406v48.668c0 1.817.968 3.496 2.546 4.406l42.133 24.336c1.575.907 3.517.907 5.09 0l42.126-24.336c1.57-.91 2.54-2.59 2.54-4.406v-48.668c0-1.816-.97-3.496-2.55-4.406l-42.12-24.317c-.79-.453-1.67-.68-2.55-.68-.88 0-1.76.227-2.55.68\"/></clipPath><linearGradient id=\"b\" x1=\"-.348\" x2=\"1.251\" gradientTransform=\"rotate(116.114 53.1 202.97) scale(86.48)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".3\" stop-color=\"#3E863D\"/><stop offset=\".5\" stop-color=\"#55934F\"/><stop offset=\".8\" stop-color=\"#5AAD45\"/></linearGradient><clipPath id=\"c\"><path d=\"M195.398 307.086c.403.523.907.976 1.5 1.316l36.14 20.875 6.02 3.46c.9.52 1.926.74 2.934.665.336-.027.672-.09 1-.183l44.434-81.36c-.34-.37-.738-.68-1.184-.94l-27.586-15.93-14.582-8.39c-.414-.24-.863-.41-1.32-.53zm0 0\"/></clipPath><linearGradient id=\"d\" x1=\"-.456\" x2=\".582\" gradientTransform=\"rotate(-36.46 550.846 -214.337) scale(132.798)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".57\" stop-color=\"#3E863D\"/><stop offset=\".72\" stop-color=\"#619857\"/><stop offset=\"1\" stop-color=\"#76AC64\"/></linearGradient><clipPath id=\"e\"><path d=\"M241.066 225.953c-.707.07-1.398.29-2.035.652l-42.01 24.247 45.3 82.51c.63-.09 1.25-.3 1.81-.624l42.13-24.336c1.3-.754 2.19-2.03 2.46-3.476l-46.18-78.89c-.34-.067-.68-.102-1.03-.102-.14 0-.28.007-.42.02\"/></clipPath><linearGradient id=\"f\" x1=\".043\" x2=\".984\" gradientTransform=\"translate(192.862 279.652) scale(97.417)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".16\" stop-color=\"#6BBF47\"/><stop offset=\".38\" stop-color=\"#79B461\"/><stop offset=\".47\" stop-color=\"#75AC64\"/><stop offset=\".7\" stop-color=\"#659E5A\"/><stop offset=\".9\" stop-color=\"#3E863D\"/></linearGradient></defs><path fill=\"#689f63\" d=\"M218.647 270.93c-1.46 0-2.91-.383-4.19-1.12l-13.337-7.896c-1.992-1.114-1.02-1.508-.363-1.735 2.656-.93 3.195-1.14 6.03-2.75.298-.17.688-.11.993.07l10.246 6.08c.37.2.895.2 1.238 0l39.95-23.06c.37-.21.61-.64.61-1.08v-46.1c0-.46-.24-.87-.618-1.1l-39.934-23.04c-.37-.22-.86-.22-1.23 0l-39.926 23.04c-.387.22-.633.65-.633 1.09v46.1c0 .44.24.86.62 1.07l10.94 6.32c5.94 2.97 9.57-.53 9.57-4.05v-45.5c0-.65.51-1.15 1.16-1.15h5.06c.63 0 1.15.5 1.15 1.15v45.52c0 7.92-4.32 12.47-11.83 12.47-2.31 0-4.13 0-9.21-2.5l-10.48-6.04c-2.59-1.5-4.19-4.3-4.19-7.29v-46.1c0-3 1.6-5.8 4.19-7.28l39.99-23.07c2.53-1.43 5.89-1.43 8.4 0l39.94 23.08c2.58 1.49 4.19 4.28 4.19 7.28v46.1c0 2.99-1.61 5.78-4.19 7.28l-39.94 23.07c-1.28.74-2.73 1.12-4.21 1.12\"/><path fill=\"#689f63\" d=\"M230.987 239.164c-17.48 0-21.145-8.024-21.145-14.754 0-.64.516-1.15 1.157-1.15h5.16c.57 0 1.05.415 1.14.978.78 5.258 3.1 7.91 13.67 7.91 8.42 0 12-1.902 12-6.367 0-2.57-1.02-4.48-14.1-5.76-10.94-1.08-17.7-3.49-17.7-12.24 0-8.06 6.8-12.86 18.19-12.86 12.79 0 19.13 4.44 19.93 13.98.03.33-.09.65-.31.89-.22.23-.53.37-.85.37h-5.19c-.54 0-1.01-.38-1.12-.9-1.25-5.53-4.27-7.3-12.48-7.3-9.19 0-10.26 3.2-10.26 5.6 0 2.91 1.26 3.76 13.66 5.4 12.28 1.63 18.11 3.93 18.11 12.56 0 8.7-7.26 13.69-19.92 13.69m48.66-48.89h1.34c1.1 0 1.31-.77 1.31-1.22 0-1.18-.81-1.18-1.26-1.18h-1.38zm-1.63-3.78h2.97c1.02 0 3.02 0 3.02 2.28 0 1.59-1.02 1.92-1.63 2.12 1.19.08 1.27.86 1.43 1.96.08.69.21 1.88.45 2.28h-1.83c-.05-.4-.33-2.6-.33-2.72-.12-.49-.29-.73-.9-.73h-1.51v3.46h-1.67zm-3.57 4.3c0 3.58 2.89 6.48 6.44 6.48 3.58 0 6.47-2.96 6.47-6.48 0-3.59-2.93-6.44-6.48-6.44-3.5 0-6.44 2.81-6.44 6.43m14.16.03c0 4.24-3.47 7.7-7.7 7.7-4.2 0-7.7-3.42-7.7-7.7 0-4.36 3.58-7.7 7.7-7.7 4.15 0 7.69 3.35 7.69 7.7\"/><path fill=\"#333\" fill-rule=\"evenodd\" d=\"M94.936 90.55c0-1.84-.97-3.53-2.558-4.445l-42.356-24.37c-.715-.42-1.516-.64-2.328-.67h-.438c-.812.03-1.613.25-2.34.67L2.562 86.105C.984 87.025 0 88.715 0 90.555l.093 65.64c0 .91.47 1.76 1.27 2.21.78.48 1.76.48 2.54 0l25.18-14.42c1.59-.946 2.56-2.618 2.56-4.44V108.88c0-1.83.97-3.52 2.555-4.43l10.72-6.174c.796-.46 1.67-.688 2.56-.688.876 0 1.77.226 2.544.687l10.715 6.172c1.586.91 2.56 2.6 2.56 4.43v30.663c0 1.82.983 3.5 2.565 4.44l25.164 14.41c.79.47 1.773.47 2.56 0 .776-.45 1.268-1.3 1.268-2.21zm199.868 34.176c0 .457-.243.88-.64 1.106l-14.548 8.386c-.395.227-.883.227-1.277 0l-14.55-8.386c-.4-.227-.64-.65-.64-1.106V107.93c0-.458.24-.88.63-1.11l14.54-8.4c.4-.23.89-.23 1.29 0l14.55 8.4c.4.23.64.652.64 1.11zM298.734.324c-.794-.442-1.76-.43-2.544.027-.78.46-1.262 1.3-1.262 2.21v65c0 .64-.34 1.23-.894 1.55-.55.32-1.235.32-1.79 0L281.634 63c-1.58-.914-3.526-.914-5.112 0l-42.37 24.453c-1.583.91-2.56 2.6-2.56 4.42v48.92c0 1.83.977 3.51 2.56 4.43l42.37 24.47c1.582.91 3.53.91 5.117 0l42.37-24.48c1.58-.92 2.56-2.6 2.56-4.43V18.863c0-1.856-1.01-3.563-2.63-4.47zm141.093 107.164c1.574-.914 2.543-2.602 2.543-4.422V91.21c0-1.824-.97-3.507-2.547-4.425l-42.1-24.44c-1.59-.92-3.54-.92-5.13 0l-42.36 24.45c-1.59.92-2.56 2.6-2.56 4.43v48.9c0 1.84.99 3.54 2.58 4.45l42.09 23.99c1.55.89 3.45.9 5.02.03l25.46-14.15c.8-.45 1.31-1.3 1.31-2.22 0-.92-.49-1.78-1.29-2.23l-42.62-24.46c-.8-.45-1.29-1.3-1.29-2.21v-15.34c0-.916.48-1.76 1.28-2.216l13.26-7.65c.79-.46 1.76-.46 2.55 0l13.27 7.65c.79.45 1.28 1.3 1.28 2.21v12.06c0 .91.49 1.76 1.28 2.22.79.45 1.77.45 2.56-.01zm0 0\"/><path fill=\"#689f63\" fill-rule=\"evenodd\" d=\"M394.538 105.2c.3-.177.676-.177.98 0l8.13 4.69c.304.176.49.5.49.85v9.39c0 .35-.186.674-.49.85l-8.13 4.69c-.304.177-.68.177-.98 0l-8.125-4.69c-.31-.176-.5-.5-.5-.85v-9.39c0-.35.18-.674.49-.85zm0 0\"/><g clip-path=\"url(#a)\" transform=\"translate(-78.306 -164.016)\"><path fill=\"url(#b)\" d=\"M331.363 246.793l-118.715-58.19-60.87 124.174L270.49 370.97zm0 0\"/></g><g clip-path=\"url(#c)\" transform=\"translate(-78.306 -164.016)\"><path fill=\"url(#d)\" d=\"M144.07 264.004l83.825 113.453 110.86-81.906-83.83-113.45zm0 0\"/></g><g clip-path=\"url(#e)\" transform=\"translate(-78.306 -164.016)\"><path fill=\"url(#f)\" d=\"M197.02 225.934v107.43h91.683v-107.43zm0 0\"/></g></svg>";

const __vite_glob_1_4 = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-11.5 -10.23174 23 20.46348\">\n  <title>React Logo</title>\n  <circle cx=\"0\" cy=\"0\" r=\"2.05\" fill=\"#61dafb\"/>\n  <g stroke=\"#61dafb\" stroke-width=\"1\" fill=\"none\">\n    <ellipse rx=\"11\" ry=\"4.2\"/>\n    <ellipse rx=\"11\" ry=\"4.2\" transform=\"rotate(60)\"/>\n    <ellipse rx=\"11\" ry=\"4.2\" transform=\"rotate(120)\"/>\n  </g>\n</svg>\n";

const __vite_glob_1_5 = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg version=\"1.1\" viewBox=\"0 0 261.76 226.69\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"matrix(1.3333 0 0 -1.3333 -76.311 313.34)\"><g transform=\"translate(178.06 235.01)\"><path d=\"m0 0-22.669-39.264-22.669 39.264h-75.491l98.16-170.02 98.16 170.02z\" fill=\"#41b883\"/></g><g transform=\"translate(178.06 235.01)\"><path d=\"m0 0-22.669-39.264-22.669 39.264h-36.227l58.896-102.01 58.896 102.01z\" fill=\"#34495e\"/></g></g></svg>\n";

const __vite_glob_1_6 = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 18.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\r\n<svg version=\"1.1\" id=\"GraphQL_Logo\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\"\r\n\t y=\"0px\" viewBox=\"0 0 400 400\" enable-background=\"new 0 0 400 400\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"122\" y=\"-0.4\" transform=\"matrix(-0.866 -0.5 0.5 -0.866 163.3196 363.3136)\" fill=\"#E535AB\" width=\"16.6\" height=\"320.3\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"39.8\" y=\"272.2\" fill=\"#E535AB\" width=\"320.3\" height=\"16.6\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"37.9\" y=\"312.2\" transform=\"matrix(-0.866 -0.5 0.5 -0.866 83.0693 663.3409)\" fill=\"#E535AB\" width=\"185\" height=\"16.6\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"177.1\" y=\"71.1\" transform=\"matrix(-0.866 -0.5 0.5 -0.866 463.3409 283.0693)\" fill=\"#E535AB\" width=\"185\" height=\"16.6\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"122.1\" y=\"-13\" transform=\"matrix(-0.5 -0.866 0.866 -0.5 126.7903 232.1221)\" fill=\"#E535AB\" width=\"16.6\" height=\"185\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"109.6\" y=\"151.6\" transform=\"matrix(-0.5 -0.866 0.866 -0.5 266.0828 473.3766)\" fill=\"#E535AB\" width=\"320.3\" height=\"16.6\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"52.5\" y=\"107.5\" fill=\"#E535AB\" width=\"16.6\" height=\"185\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"330.9\" y=\"107.5\" fill=\"#E535AB\" width=\"16.6\" height=\"185\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<g>\r\n\t\t<g>\r\n\t\t\t\r\n\t\t\t\t<rect x=\"262.4\" y=\"240.1\" transform=\"matrix(-0.5 -0.866 0.866 -0.5 126.7953 714.2875)\" fill=\"#E535AB\" width=\"14.5\" height=\"160.9\"/>\r\n\t\t</g>\r\n\t</g>\r\n\t<path fill=\"#E535AB\" d=\"M369.5,297.9c-9.6,16.7-31,22.4-47.7,12.8c-16.7-9.6-22.4-31-12.8-47.7c9.6-16.7,31-22.4,47.7-12.8\r\n\t\tC373.5,259.9,379.2,281.2,369.5,297.9\"/>\r\n\t<path fill=\"#E535AB\" d=\"M90.9,137c-9.6,16.7-31,22.4-47.7,12.8c-16.7-9.6-22.4-31-12.8-47.7c9.6-16.7,31-22.4,47.7-12.8\r\n\t\tC94.8,99,100.5,120.3,90.9,137\"/>\r\n\t<path fill=\"#E535AB\" d=\"M30.5,297.9c-9.6-16.7-3.9-38,12.8-47.7c16.7-9.6,38-3.9,47.7,12.8c9.6,16.7,3.9,38-12.8,47.7\r\n\t\tC61.4,320.3,40.1,314.6,30.5,297.9\"/>\r\n\t<path fill=\"#E535AB\" d=\"M309.1,137c-9.6-16.7-3.9-38,12.8-47.7c16.7-9.6,38-3.9,47.7,12.8c9.6,16.7,3.9,38-12.8,47.7\r\n\t\tC340.1,159.4,318.7,153.7,309.1,137\"/>\r\n\t<path fill=\"#E535AB\" d=\"M200,395.8c-19.3,0-34.9-15.6-34.9-34.9c0-19.3,15.6-34.9,34.9-34.9c19.3,0,34.9,15.6,34.9,34.9\r\n\t\tC234.9,380.1,219.3,395.8,200,395.8\"/>\r\n\t<path fill=\"#E535AB\" d=\"M200,74c-19.3,0-34.9-15.6-34.9-34.9c0-19.3,15.6-34.9,34.9-34.9c19.3,0,34.9,15.6,34.9,34.9\r\n\t\tC234.9,58.4,219.3,74,200,74\"/>\r\n</g>\r\n</svg>\r\n";

const __vite_glob_1_7 = "<svg viewBox=\"0 0 190 190\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path\n    d=\"M137.548 65.935L137.479 65.9052C137.439 65.8904 137.399 65.8755 137.365 65.8408C137.308 65.7797 137.266 65.7064 137.242 65.6265C137.218 65.5466 137.212 65.4623 137.226 65.38L141.056 41.9614L159.019 59.9292L140.338 67.8774C140.286 67.8984 140.23 67.9085 140.174 67.9071H140.1C140.075 67.8923 140.05 67.8725 140.001 67.8229C139.306 67.0488 138.474 66.4089 137.548 65.935V65.935ZM163.603 64.5078L182.809 83.7144C186.798 87.7083 188.795 89.7004 189.524 92.0095C189.633 92.3514 189.722 92.6933 189.791 93.0452L143.891 73.6057C143.866 73.5955 143.841 73.5856 143.816 73.576C143.633 73.5016 143.42 73.4174 143.42 73.2291C143.42 73.0408 143.638 72.9516 143.821 72.8773L143.881 72.8525L163.603 64.5078ZM189.008 99.2095C188.017 101.073 186.085 103.005 182.814 106.281L161.16 127.93L133.153 122.098L133.004 122.068C132.756 122.028 132.494 121.984 132.494 121.761C132.387 120.606 132.044 119.484 131.486 118.467C130.927 117.45 130.166 116.559 129.248 115.849C129.134 115.735 129.164 115.557 129.198 115.393C129.198 115.369 129.198 115.344 129.208 115.324L134.476 82.986L134.496 82.877C134.525 82.6292 134.57 82.3418 134.793 82.3418C135.922 82.2014 137.011 81.8377 137.998 81.272C138.985 80.7062 139.849 79.9497 140.541 79.0466C140.586 78.997 140.615 78.9425 140.675 78.9128C140.833 78.8384 141.022 78.9128 141.185 78.9821L189.003 99.2095H189.008ZM156.18 132.91L120.571 168.519L126.666 131.057L126.676 131.007C126.681 130.958 126.691 130.908 126.706 130.864C126.755 130.745 126.884 130.695 127.008 130.646L127.068 130.621C128.402 130.051 129.582 129.173 130.512 128.059C130.63 127.92 130.774 127.786 130.957 127.762C131.005 127.754 131.054 127.754 131.101 127.762L156.175 132.915L156.18 132.91ZM113.034 176.056L109.021 180.069L64.6463 115.938C64.6302 115.915 64.6137 115.892 64.5967 115.869C64.5273 115.775 64.453 115.681 64.4679 115.572C64.4679 115.492 64.5224 115.423 64.5769 115.364L64.6264 115.299C64.7602 115.101 64.8742 114.903 64.9981 114.69L65.0972 114.516L65.112 114.501C65.1814 114.382 65.2458 114.269 65.3648 114.204C65.4688 114.155 65.6125 114.174 65.7265 114.199L114.888 124.338C115.025 124.359 115.155 124.415 115.264 124.501C115.329 124.566 115.343 124.635 115.358 124.714C115.701 126.012 116.339 127.212 117.223 128.222C118.107 129.232 119.212 130.024 120.452 130.537C120.591 130.606 120.532 130.76 120.467 130.923C120.435 130.995 120.41 131.069 120.393 131.146C119.773 134.912 114.461 167.31 113.034 176.056ZM104.65 184.435C101.692 187.363 99.9475 188.914 97.9753 189.539C96.0307 190.154 93.9438 190.154 91.9993 189.539C89.6901 188.805 87.6931 186.813 83.7042 182.82L39.1416 138.257L50.7815 120.205C50.836 120.116 50.8905 120.036 50.9797 119.972C51.1035 119.883 51.2819 119.922 51.4306 119.972C54.1023 120.778 56.9708 120.633 59.5473 119.561C59.6811 119.511 59.8149 119.476 59.9189 119.571C59.971 119.618 60.0175 119.671 60.0577 119.729L104.65 184.44V184.435ZM34.8454 133.961L24.6227 123.738L44.8104 115.126C44.862 115.103 44.9176 115.091 44.9739 115.091C45.1424 115.091 45.2415 115.26 45.3307 115.413C45.5335 115.725 45.7484 116.029 45.9749 116.325L46.0393 116.404C46.0987 116.488 46.0591 116.573 45.9996 116.652L34.8503 133.961H34.8454ZM20.0985 119.214L7.1653 106.281C4.96517 104.081 3.36957 102.485 2.2596 101.112L41.5845 109.269C41.6339 109.278 41.6835 109.286 41.7332 109.293C41.976 109.333 42.2435 109.378 42.2435 109.606C42.2435 109.853 41.9512 109.967 41.7034 110.062L41.5895 110.111L20.0985 119.214ZM0 94.4624C0.0448161 93.6292 0.194659 92.8051 0.445973 92.0095C1.17935 89.7004 3.17136 87.7083 7.1653 83.7144L23.7159 67.1639C31.3362 78.2234 38.9772 89.2687 46.6389 100.3C46.7727 100.478 46.9213 100.676 46.7677 100.825C46.0442 101.623 45.3208 102.495 44.8104 103.441C44.755 103.563 44.6698 103.669 44.5626 103.749C44.4982 103.788 44.4288 103.773 44.3545 103.758H44.3446L0 94.4574V94.4624ZM28.1459 62.7339L50.39 40.4798C52.4861 41.3965 60.1023 44.6125 66.9059 47.4865C72.0593 49.6669 76.7569 51.649 78.2336 52.2931C78.3822 52.3526 78.516 52.4121 78.5804 52.5607C78.6201 52.6499 78.6002 52.7639 78.5804 52.858C78.2282 54.4644 78.2806 56.1331 78.7329 57.7142C79.1853 59.2953 80.0234 60.7393 81.172 61.9162C81.3207 62.0649 81.172 62.278 81.0432 62.4613L80.9738 62.5654L58.3779 97.5644C58.3184 97.6635 58.2639 97.7477 58.1648 97.8121C58.0459 97.8864 57.8774 97.8518 57.7386 97.8171C56.8598 97.5868 55.9563 97.4637 55.0479 97.4504C54.2353 97.4504 53.3532 97.599 52.4613 97.7626H52.4563C52.3572 97.7774 52.268 97.7972 52.1887 97.7378C52.1012 97.6662 52.0259 97.5809 51.9658 97.4851L28.1409 62.7339H28.1459ZM54.8943 35.9854L83.7042 7.17554C87.6931 3.18656 89.6901 1.1896 91.9993 0.461174C93.9438 -0.153725 96.0307 -0.153725 97.9753 0.461174C100.284 1.1896 102.281 3.18656 106.27 7.17554L112.514 13.4192L92.024 45.1526C91.9734 45.245 91.9042 45.326 91.8209 45.3905C91.697 45.4747 91.5236 45.44 91.3749 45.3905C89.7594 44.9002 88.0488 44.811 86.3911 45.1304C84.7334 45.4499 83.1784 46.1684 81.8608 47.2239C81.727 47.3627 81.5288 47.2834 81.3603 47.209C78.6845 46.0446 57.8724 37.249 54.8943 35.9854V35.9854ZM116.865 17.7699L135.784 36.689L131.225 64.9241V64.9984C131.221 65.0628 131.208 65.1262 131.185 65.1867C131.136 65.2858 131.037 65.3056 130.938 65.3354C129.963 65.6306 129.045 66.0879 128.222 66.6882C128.187 66.7134 128.154 66.7415 128.123 66.7724C128.069 66.8319 128.014 66.8864 127.925 66.8963C127.852 66.8985 127.78 66.8867 127.712 66.8616L98.8821 54.6122L98.8276 54.5874C98.6443 54.5131 98.4262 54.4239 98.4262 54.2356C98.2568 52.629 97.7321 51.0803 96.8901 49.7015C96.7514 49.4736 96.5977 49.2357 96.7167 49.0029L116.865 17.7699ZM97.3807 60.4148L124.407 71.8614C124.555 71.9308 124.719 71.9952 124.783 72.1488C124.809 72.2412 124.809 72.3389 124.783 72.4313C124.704 72.8277 124.635 73.2786 124.635 73.7345V74.4927C124.635 74.681 124.441 74.7603 124.263 74.8346L124.208 74.8544C119.927 76.6829 64.1012 100.488 64.0169 100.488C63.9327 100.488 63.8435 100.488 63.7593 100.404C63.6106 100.255 63.7593 100.047 63.8931 99.8586C63.9167 99.826 63.9398 99.7929 63.9624 99.7595L86.1719 65.3701L86.2115 65.3106C86.3404 65.1025 86.489 64.8696 86.7269 64.8696L86.9499 64.9043C87.4553 64.9736 87.9013 65.0381 88.3522 65.0381C91.7218 65.0381 94.8436 63.3979 96.7266 60.5932C96.7714 60.5183 96.8284 60.4513 96.8951 60.395C97.0289 60.2959 97.2271 60.3454 97.3807 60.4148V60.4148ZM66.4301 105.929L127.281 79.9782C127.281 79.9782 127.37 79.9782 127.454 80.0624C127.786 80.3944 128.069 80.6174 128.341 80.8255L128.475 80.9097C128.599 80.9791 128.723 81.0584 128.733 81.1872C128.733 81.2368 128.733 81.2665 128.723 81.3111L123.51 113.332L123.49 113.461C123.455 113.709 123.421 113.991 123.188 113.991C121.798 114.085 120.452 114.516 119.266 115.247C118.081 115.979 117.091 116.988 116.384 118.188L116.359 118.228C116.29 118.342 116.226 118.451 116.112 118.51C116.007 118.56 115.874 118.54 115.765 118.515L67.2379 108.506C67.1883 108.496 66.4847 105.934 66.4301 105.929V105.929Z\"\n    fill=\"currentColor\"\n  />\n</svg>\n";

const __vite_glob_1_8 = "<svg viewBox=\"0 0 190 190\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path\n    d=\"M113.3 0H111.3V2V20.5996V22.5996H113.3H131.9H133.9V20.5996V2V0H131.9H113.3Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M53.5 0C46.3 0 39.3002 1.4002 32.7002 4.2002C26.3002 6.9002 20.6002 10.8002 15.7002 15.7002C10.8002 20.6002 6.9002 26.3002 4.2002 32.7002C1.4002 39.3002 0 46.3 0 53.5V131.9V133.9H2H20.5996H22.5996V131.9V53.2002C22.9996 45.1002 26.3996 37.5004 32.0996 31.9004C37.8996 26.2004 45.4996 22.8996 53.5996 22.5996H94.7998H96.7998V20.5996V2V0H94.7998H53.5Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M150.4 74.2002H148.4V76.2002V94.7998V96.7998H150.4H169H171V94.7998V76.2002V74.2002H169H150.4Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M150.4 37.0996H148.4V39.0996V57.7002V59.7002H150.4H169H171V57.7002V39.0996V37.0996H169H150.4Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M169 0H150.4H148.4V2V20.5996V22.5996H150.4H169H171V20.5996V2V0H169Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M150.4 111.3H148.4V113.3V131.9V133.9H150.4H169H171V131.9V113.3V111.3H169H150.4Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M150.4 148.4H148.4V150.4V169V171H150.4H169H171V169V150.4V148.4H169H150.4Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M113.3 148.4H111.3V150.4V169V171H113.3H131.9H133.9V169V150.4V148.4H131.9H113.3Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M76.2002 148.4H74.2002V150.4V169V171H76.2002H94.7998H96.7998V169V150.4V148.4H94.7998H76.2002Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M39.0996 148.4H37.0996V150.4V169V171H39.0996H57.7002H59.7002V169V150.4V148.4H57.7002H39.0996Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M2 148.4H0V150.4V169V171H2H20.5996H22.5996V169V150.4V148.4H20.5996H2Z\"\n    fill=\"currentColor\"\n  />\n</svg>\n";

const __vite_glob_1_9 = "<svg viewBox=\"0 0 190 190\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M94.9998 13L190 177.546H0L94.9998 13Z\" fill=\"currentColor\" />\n</svg>\n";

const __vite_glob_1_10 = "<!-- source: https://github.com/basmilius/weather-icons -->\n<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n  viewBox=\"0 0 512 512\"\n>\n  <defs>\n    <linearGradient\n      id=\"a\"\n      x1=\"54.33\"\n      y1=\"29.03\"\n      x2=\"187.18\"\n      y2=\"259.13\"\n      gradientUnits=\"userSpaceOnUse\"\n    >\n      <stop offset=\"0\" stop-color=\"currentColor\" />\n      <stop offset=\"0.45\" stop-color=\"currentColor\" />\n      <stop offset=\"1\" stop-color=\"currentColor\" />\n    </linearGradient>\n    <linearGradient\n      id=\"b\"\n      x1=\"294\"\n      y1=\"112.82\"\n      x2=\"330\"\n      y2=\"175.18\"\n      gradientUnits=\"userSpaceOnUse\"\n    >\n      <stop offset=\"0\" stop-color=\"currentColor\" />\n      <stop offset=\"0.45\" stop-color=\"currentColor\" />\n      <stop offset=\"1\" stop-color=\"currentColor\" />\n    </linearGradient>\n    <linearGradient\n      id=\"c\"\n      x1=\"295.52\"\n      y1=\"185.86\"\n      x2=\"316.48\"\n      y2=\"222.14\"\n      xlink:href=\"#b\"\n    />\n    <linearGradient\n      id=\"d\"\n      x1=\"356.29\"\n      y1=\"194.78\"\n      x2=\"387.71\"\n      y2=\"249.22\"\n      xlink:href=\"#b\"\n    />\n    <symbol id=\"e\" viewBox=\"0 0 270 270\" overflow=\"visible\">\n      <!-- moon -->\n      <path\n        d=\"M252.25,168.63C178.13,168.63,118,109.35,118,36.21A130.48,130.48,0,0,1,122.47,3C55.29,10.25,3,66.37,3,134.58,3,207.71,63.09,267,137.21,267,199.69,267,252,224.82,267,167.79A135.56,135.56,0,0,1,252.25,168.63Z\"\n        stroke=\"currentColor\"\n        stroke-linecap=\"round\"\n        stroke-linejoin=\"round\"\n        stroke-width=\"6\"\n        fill=\"url(#a)\"\n      >\n        <animateTransform\n          attributeName=\"transform\"\n          additive=\"sum\"\n          type=\"rotate\"\n          values=\"-15 135 135; 9 135 135; -15 135 135\"\n          dur=\"6s\"\n          repeatCount=\"indefinite\"\n        />\n      </path>\n    </symbol>\n  </defs>\n\n  <!-- star-1 -->\n  <path\n    d=\"M282.83,162.84l24.93-6.42a1.78,1.78,0,0,1,1.71.46l18.37,18a1.8,1.8,0,0,0,3-1.73l-6.42-24.93a1.78,1.78,0,0,1,.46-1.71l18-18.37a1.8,1.8,0,0,0-1.73-3l-24.93,6.42a1.78,1.78,0,0,1-1.71-.46l-18.37-18a1.8,1.8,0,0,0-3,1.73l6.42,24.93a1.78,1.78,0,0,1-.46,1.71l-18,18.37A1.8,1.8,0,0,0,282.83,162.84Z\"\n    stroke=\"currentColor\"\n    stroke-linecap=\"round\"\n    stroke-linejoin=\"round\"\n    stroke-width=\"2\"\n    fill=\"url(#b)\"\n  >\n    <animateTransform\n      attributeName=\"transform\"\n      additive=\"sum\"\n      type=\"rotate\"\n      values=\"-15 312 144; 15 312 144; -15 312 144\"\n      dur=\"6s\"\n      calcMode=\"spline\"\n      keySplines=\".42, 0, .58, 1; .42, 0, .58, 1\"\n      repeatCount=\"indefinite\"\n    />\n\n    <animate\n      attributeName=\"opacity\"\n      values=\"1; .75; 1; .75; 1; .75; 1\"\n      dur=\"6s\"\n    />\n  </path>\n\n  <!-- star-2 -->\n  <path\n    d=\"M285.4,193.44l12,12.25a1.19,1.19,0,0,1,.3,1.14l-4.28,16.62a1.2,1.2,0,0,0,2,1.15l12.25-12a1.19,1.19,0,0,1,1.14-.3l16.62,4.28a1.2,1.2,0,0,0,1.15-2l-12-12.25a1.19,1.19,0,0,1-.3-1.14l4.28-16.62a1.2,1.2,0,0,0-2-1.15l-12.25,12a1.19,1.19,0,0,1-1.14.3l-16.62-4.28A1.2,1.2,0,0,0,285.4,193.44Z\"\n    stroke=\"currentColor\"\n    stroke-linecap=\"round\"\n    stroke-linejoin=\"round\"\n    stroke-width=\"2\"\n    fill=\"url(#c)\"\n  >\n    <animateTransform\n      attributeName=\"transform\"\n      additive=\"sum\"\n      type=\"rotate\"\n      values=\"-15 306 204; 15 306 204; -15 306 204\"\n      begin=\"-.33s\"\n      dur=\"6s\"\n      calcMode=\"spline\"\n      keySplines=\".42, 0, .58, 1; .42, 0, .58, 1\"\n      repeatCount=\"indefinite\"\n    />\n\n    <animate\n      attributeName=\"opacity\"\n      values=\"1; .75; 1; .75; 1; .75; 1\"\n      begin=\"-.33s\"\n      dur=\"6s\"\n    />\n  </path>\n\n  <!-- star-3 -->\n  <path\n    d=\"M337.32,223.73l24.8,6.9a1.83,1.83,0,0,1,1.25,1.25l6.9,24.8a1.79,1.79,0,0,0,3.46,0l6.9-24.8a1.83,1.83,0,0,1,1.25-1.25l24.8-6.9a1.79,1.79,0,0,0,0-3.46l-24.8-6.9a1.83,1.83,0,0,1-1.25-1.25l-6.9-24.8a1.79,1.79,0,0,0-3.46,0l-6.9,24.8a1.83,1.83,0,0,1-1.25,1.25l-24.8,6.9A1.79,1.79,0,0,0,337.32,223.73Z\"\n    stroke=\"currentColor\"\n    stroke-linecap=\"round\"\n    stroke-linejoin=\"round\"\n    stroke-width=\"2\"\n    fill=\"url(#d)\"\n  >\n    <animateTransform\n      attributeName=\"transform\"\n      additive=\"sum\"\n      type=\"rotate\"\n      values=\"-15 372 222; 15 372 222; -15 372 222\"\n      begin=\"-.67s\"\n      dur=\"6s\"\n      calcMode=\"spline\"\n      keySplines=\".42, 0, .58, 1; .42, 0, .58, 1\"\n      repeatCount=\"indefinite\"\n    />\n\n    <animate\n      attributeName=\"opacity\"\n      values=\"1; .75; 1; .75; 1; .75; 1\"\n      begin=\"-.67s\"\n      dur=\"6s\"\n    />\n  </path>\n\n  <use\n    width=\"270\"\n    height=\"270\"\n    transform=\"translate(121 121)\"\n    xlink:href=\"#e\"\n  />\n</svg>\n";

const __vite_glob_1_11 = "<!-- source: https://github.com/basmilius/weather-icons -->\n<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n  viewBox=\"0 0 512 512\"\n>\n  <defs>\n    <linearGradient\n      id=\"a\"\n      x1=\"149.99\"\n      y1=\"119.24\"\n      x2=\"234.01\"\n      y2=\"264.76\"\n      gradientUnits=\"userSpaceOnUse\"\n    >\n      <stop offset=\"0\" stop-color=\"currentColor\" />\n      <stop offset=\"0.45\" stop-color=\"currentColor\" />\n      <stop offset=\"1\" stop-color=\"currentColor\" />\n    </linearGradient>\n    <symbol id=\"b\" viewBox=\"0 0 384 384\">\n      <!-- core -->\n      <circle\n        cx=\"192\"\n        cy=\"192\"\n        r=\"84\"\n        stroke=\"currentColor\"\n        stroke-miterlimit=\"10\"\n        stroke-width=\"6\"\n        fill=\"url(#a)\"\n      />\n\n      <!-- rays -->\n      <path\n        d=\"M192,61.66V12m0,360V322.34M284.17,99.83l35.11-35.11M64.72,319.28l35.11-35.11m0-184.34L64.72,64.72M319.28,319.28l-35.11-35.11M61.66,192H12m360,0H322.34\"\n        fill=\"none\"\n        stroke=\"currentColor\"\n        stroke-linecap=\"round\"\n        stroke-miterlimit=\"10\"\n        stroke-width=\"24\"\n      >\n        <animateTransform\n          attributeName=\"transform\"\n          additive=\"sum\"\n          type=\"rotate\"\n          values=\"0 192 192; 45 192 192\"\n          dur=\"6s\"\n          repeatCount=\"indefinite\"\n        />\n      </path>\n    </symbol>\n  </defs>\n  <use width=\"384\" height=\"384\" transform=\"translate(64 64)\" xlink:href=\"#b\" />\n</svg>\n";

const __vite_glob_1_12 = "<svg viewBox=\"0 0 1847 457\" fill=\"none\">\n  <path\n    d=\"M134.148 456.833C202.08 456.833 253.03 432.665 273.93 391.516C273.93 411.111 275.23 431.36 278.5 447.036H390.19C384.97 424.173 382.36 392.82 382.36 351.671V251.081C382.36 155.717 326.18 110.648 201.43 110.648C92.3441 110.648 19.188 155.717 10.697 229.527H126.963C130.882 197.521 157.66 179.885 201.43 179.885C244.53 179.885 268.7 197.521 268.7 234.1V243.896L150.48 254.347C92.997 260.227 60.338 270.023 37.477 285.7C13.31 302.028 0.898987 326.851 0.898987 357.549C0.898987 418.948 51.847 456.833 134.148 456.833ZM177.26 388.902C139.37 388.902 116.512 373.88 116.512 349.712C116.512 324.892 135.45 311.827 183.14 305.949L270.66 296.805V316.4C270.66 360.163 232.78 388.902 177.26 388.902Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M625.77 456.833C739.43 456.833 797.56 414.377 797.56 345.793C797.56 288.966 764.9 257.613 685.87 247.162L587.23 236.059C559.15 232.138 547.39 224.953 547.39 209.277C547.39 190.336 566.33 181.844 609.44 181.844C668.88 181.844 710.03 195.561 743.35 222.342L796.25 169.434C759.67 131.55 696.32 110.648 617.94 110.648C507.55 110.648 446.15 149.838 446.15 215.809C446.15 273.289 484.03 305.295 562.41 315.745L651.25 326.196C686.52 330.769 696.97 337.302 696.97 354.283C696.97 373.88 677.37 384.331 631.65 384.331C563.72 384.331 518 366.041 487.3 332.076L427.21 381.717C467.05 431.36 534.98 456.833 625.77 456.833Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M889.78 194.255V332.076C889.78 413.07 935.5 454.221 1033.48 454.221C1063.53 454.221 1087.04 450.955 1109.25 444.423V359.508C1097.49 362.122 1083.12 364.734 1064.18 364.734C1023.03 364.734 1002.78 346.446 1002.78 307.908V194.255H1109.9V120.445H1002.78V0.914001L889.78 42.717V120.445H816.62V194.255H889.78Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M1272.13 120.445H1168.93V447.036H1281.93V324.892C1281.93 289.618 1289.77 257.613 1311.33 237.364C1328.31 221.687 1352.48 213.198 1386.44 213.198C1398.85 213.198 1408.65 214.502 1419.75 215.809V113.26C1412.57 111.954 1407.34 111.954 1398.2 111.954C1333.53 111.954 1289.77 149.185 1272.13 209.932V120.445Z\"\n    fill=\"currentColor\"\n  />\n  <path\n    d=\"M1643.05 456.833C1762.59 456.833 1846.85 393.475 1846.85 283.088C1846.85 173.353 1762.59 110.648 1643.05 110.648C1522.87 110.648 1438.61 173.353 1438.61 283.088C1438.61 393.475 1522.87 456.833 1643.05 456.833ZM1643.05 381.717C1588.19 381.717 1553.57 346.446 1553.57 283.088C1553.57 219.728 1588.19 185.763 1643.05 185.763C1697.27 185.763 1731.89 219.728 1731.89 283.088C1731.89 346.446 1697.27 381.717 1643.05 381.717Z\"\n    fill=\"currentColor\"\n  />\n</svg>\n";

const SPRITESHEET_NAMESPACE = `astroicon`;

const $$module1$4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  SPRITESHEET_NAMESPACE
}, Symbol.toStringTag, { value: 'Module' }));

const baseURL = "https://api.astroicon.dev/v1/";
const requests = /* @__PURE__ */ new Map();
const fetchCache = /* @__PURE__ */ new Map();
async function get(pack, name) {
  const url = new URL(`./${pack}/${name}`, baseURL).toString();
  if (requests.has(url)) {
    return await requests.get(url);
  }
  if (fetchCache.has(url)) {
    return fetchCache.get(url);
  }
  let request = async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const contentType = res.headers.get("Content-Type");
    if (!contentType.includes("svg")) {
      throw new Error(`[astro-icon] Unable to load "${name}" because it did not resolve to an SVG!

Recieved the following "Content-Type":
${contentType}`);
    }
    const svg = await res.text();
    fetchCache.set(url, svg);
    requests.delete(url);
    return svg;
  };
  let promise = request();
  requests.set(url, promise);
  return await promise;
}

const splitAttrsTokenizer = /([a-z0-9_\:\-]*)\s*?=\s*?(['"]?)(.*?)\2\s+/gim;
const domParserTokenizer = /(?:<(\/?)([a-zA-Z][a-zA-Z0-9\:]*)(?:\s([^>]*?))?((?:\s*\/)?)>|(<\!\-\-)([\s\S]*?)(\-\->)|(<\!\[CDATA\[)([\s\S]*?)(\]\]>))/gm;
const splitAttrs = (str) => {
  let res = {};
  let token;
  if (str) {
    splitAttrsTokenizer.lastIndex = 0;
    str = " " + (str || "") + " ";
    while (token = splitAttrsTokenizer.exec(str)) {
      res[token[1]] = token[3];
    }
  }
  return res;
};
function optimizeSvg(contents, name, options) {
  return optimize(contents, {
    plugins: [
      "removeDoctype",
      "removeXMLProcInst",
      "removeComments",
      "removeMetadata",
      "removeXMLNS",
      "removeEditorsNSData",
      "cleanupAttrs",
      "minifyStyles",
      "convertStyleToAttrs",
      {
        name: "cleanupIDs",
        params: { prefix: `${SPRITESHEET_NAMESPACE}:${name}` }
      },
      "removeRasterImages",
      "removeUselessDefs",
      "cleanupNumericValues",
      "cleanupListOfValues",
      "convertColors",
      "removeUnknownsAndDefaults",
      "removeNonInheritableGroupAttrs",
      "removeUselessStrokeAndFill",
      "removeViewBox",
      "cleanupEnableBackground",
      "removeHiddenElems",
      "removeEmptyText",
      "convertShapeToPath",
      "moveElemsAttrsToGroup",
      "moveGroupAttrsToElems",
      "collapseGroups",
      "convertPathData",
      "convertTransform",
      "removeEmptyAttrs",
      "removeEmptyContainers",
      "mergePaths",
      "removeUnusedNS",
      "sortAttrs",
      "removeTitle",
      "removeDesc",
      "removeDimensions",
      "removeStyleElement",
      "removeScriptElement"
    ]
  }).data;
}
const preprocessCache = /* @__PURE__ */ new Map();
function preprocess(contents, name, { optimize }) {
  if (preprocessCache.has(contents)) {
    return preprocessCache.get(contents);
  }
  if (optimize) {
    contents = optimizeSvg(contents, name);
  }
  domParserTokenizer.lastIndex = 0;
  let result = contents;
  let token;
  if (contents) {
    while (token = domParserTokenizer.exec(contents)) {
      const tag = token[2];
      if (tag === "svg") {
        const attrs = splitAttrs(token[3]);
        result = contents.slice(domParserTokenizer.lastIndex).replace(/<\/svg>/gim, "").trim();
        const value = { innerHTML: result, defaultProps: attrs };
        preprocessCache.set(contents, value);
        return value;
      }
    }
  }
}
function normalizeProps(inputProps) {
  const size = inputProps.size;
  delete inputProps.size;
  const w = inputProps.width ?? size;
  const h = inputProps.height ?? size;
  const width = w ? toAttributeSize(w) : void 0;
  const height = h ? toAttributeSize(h) : void 0;
  return { ...inputProps, width, height };
}
const toAttributeSize = (size) => String(size).replace(/(?<=[0-9])x$/, "em");
const fallback = {
  innerHTML: '<rect width="24" height="24" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />',
  props: {
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    "aria-hidden": "true"
  }
};
async function load(name, inputProps, optimize) {
  const key = name;
  if (!name) {
    throw new Error("<Icon> requires a name!");
  }
  let svg = "";
  let filepath = "";
  if (name.includes(":")) {
    const [pack, ..._name] = name.split(":");
    name = _name.join(":");
    filepath = `/src/icons/${pack}`;
    let get$1;
    try {
      const files = /* #__PURE__ */ Object.assign({});
      const keys = Object.fromEntries(
        Object.keys(files).map((key2) => [key2.replace(/\.[cm]?[jt]s$/, ""), key2])
      );
      if (!(filepath in keys)) {
        throw new Error(`Could not find the file "${filepath}"`);
      }
      const mod = files[keys[filepath]];
      if (typeof mod.default !== "function") {
        throw new Error(
          `[astro-icon] "${filepath}" did not export a default function!`
        );
      }
      get$1 = mod.default;
    } catch (e) {
    }
    if (typeof get$1 === "undefined") {
      get$1 = get.bind(null, pack);
    }
    const contents = await get$1(name);
    if (!contents) {
      throw new Error(
        `<Icon pack="${pack}" name="${name}" /> did not return an icon!`
      );
    }
    if (!/<svg/gim.test(contents)) {
      throw new Error(
        `Unable to process "<Icon pack="${pack}" name="${name}" />" because an SVG string was not returned!

Recieved the following content:
${contents}`
      );
    }
    svg = contents;
  } else {
    filepath = `/src/icons/${name}.svg`;
    try {
      const files = /* #__PURE__ */ Object.assign({"/src/icons/frameworks/express.svg": __vite_glob_1_0,"/src/icons/frameworks/logomark.svg": __vite_glob_1_1,"/src/icons/frameworks/next.svg": __vite_glob_1_2,"/src/icons/frameworks/node.svg": __vite_glob_1_3,"/src/icons/frameworks/react2.svg": __vite_glob_1_4,"/src/icons/frameworks/vue2.svg": __vite_glob_1_5,"/src/icons/platforms/graphql.svg": __vite_glob_1_6,"/src/icons/platforms/netlify.svg": __vite_glob_1_7,"/src/icons/platforms/render.svg": __vite_glob_1_8,"/src/icons/platforms/vercel.svg": __vite_glob_1_9,"/src/icons/theme/dark.svg": __vite_glob_1_10,"/src/icons/theme/light.svg": __vite_glob_1_11,"/src/icons/wordmark.svg": __vite_glob_1_12});
      if (!(filepath in files)) {
        throw new Error(`Could not find the file "${filepath}"`);
      }
      const contents = files[filepath];
      if (!/<svg/gim.test(contents)) {
        throw new Error(
          `Unable to process "${filepath}" because it is not an SVG!

Recieved the following content:
${contents}`
        );
      }
      svg = contents;
    } catch (e) {
      throw new Error(
        `[astro-icon] Unable to load "${filepath}". Does the file exist?`
      );
    }
  }
  const { innerHTML, defaultProps } = preprocess(svg, key, { optimize });
  if (!innerHTML.trim()) {
    throw new Error(`Unable to parse "${filepath}"!`);
  }
  return {
    innerHTML,
    props: { ...defaultProps, ...normalizeProps(inputProps) }
  };
}

const $$module2$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  preprocess,
  normalizeProps,
  fallback,
  default: load
}, Symbol.toStringTag, { value: 'Module' }));

const $$module4$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: 'Module' }));

createMetadata("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Icon.astro", { modules: [{ module: $$module2$7, specifier: "./utils.ts", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$h = createAstro("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Icon.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Icon = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$h, $$props, $$slots);
  Astro2.self = $$Icon;
  let { name, pack, title, optimize = true, class: className, ...inputProps } = Astro2.props;
  let props = {};
  if (pack) {
    name = `${pack}:${name}`;
  }
  let innerHTML = "";
  try {
    const svg = await load(name, { ...inputProps, class: className }, optimize);
    innerHTML = svg.innerHTML;
    props = svg.props;
  } catch (e) {
    if ((Object.assign({"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true},{_:process.env._,})).MODE === "production") {
      throw new Error(`[astro-icon] Unable to load icon "${name}"!
${e}`);
    }
    innerHTML = fallback.innerHTML;
    props = { ...fallback.props, ...normalizeProps(inputProps) };
    title = `Failed to load "${name}"!`;
    console.error(e);
  }
  return renderTemplate`${maybeRenderHead($$result)}<svg${spreadAttributes(props)}${addAttribute(name, "astro-icon")}>${markHTMLString((title ? `<title>${title}</title>` : "") + innerHTML)}</svg>`;
});

const AstroIcon = Symbol("AstroIcon");
function trackSprite(result, name) {
  if (typeof result[AstroIcon] !== "undefined") {
    result[AstroIcon]["sprites"].add(name);
  } else {
    result[AstroIcon] = {
      sprites: /* @__PURE__ */ new Set([name])
    };
  }
}
const warned = /* @__PURE__ */ new Set();
async function getUsedSprites(result) {
  if (typeof result[AstroIcon] !== "undefined") {
    return Array.from(result[AstroIcon]["sprites"]);
  }
  const pathname = result._metadata.pathname;
  if (!warned.has(pathname)) {
    console.log(`[astro-icon] No sprites found while rendering "${pathname}"`);
    warned.add(pathname);
  }
  return [];
}

const $$module3$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  trackSprite,
  getUsedSprites
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$d = createMetadata("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Spritesheet.astro", { modules: [{ module: $$module1$4, specifier: "./constants", assert: {} }, { module: $$module2$7, specifier: "./utils.ts", assert: {} }, { module: $$module3$3, specifier: "./context.ts", assert: {} }, { module: $$module4$1, specifier: "./Props.ts", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$g = createAstro("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Spritesheet.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Spritesheet = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$g, $$props, $$slots);
  Astro2.self = $$Spritesheet;
  const { optimize = true, style, ...props } = Astro2.props;
  const names = await getUsedSprites($$result);
  const icons = await Promise.all(names.map((name) => {
    return load(name, {}, optimize).then((res) => ({ ...res, name })).catch((e) => {
      if ((Object.assign({"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true},{_:process.env._,})).MODE === "production") {
        throw new Error(`[astro-icon] Unable to load icon "${name}"!
${e}`);
      }
      return { ...fallback, name };
    });
  }));
  return renderTemplate`${maybeRenderHead($$result)}<svg${addAttribute(`display: none; ${style ?? ""}`.trim(), "style")}${spreadAttributes({ "aria-hidden": true, ...props })} astro-icon-spritesheet>
    ${icons.map((icon) => renderTemplate`<symbol${spreadAttributes(icon.props)}${addAttribute(`${SPRITESHEET_NAMESPACE}:${icon.name}`, "id")}>${markHTMLString(icon.innerHTML)}</symbol>`)}
</svg>`;
});

const $$file$d = "/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Spritesheet.astro";
const $$url$d = undefined;

const $$module1$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$d,
  default: $$Spritesheet,
  file: $$file$d,
  url: $$url$d
}, Symbol.toStringTag, { value: 'Module' }));

createMetadata("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/SpriteProvider.astro", { modules: [{ module: $$module1$3, specifier: "./Spritesheet.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$f = createAstro("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/SpriteProvider.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$SpriteProvider = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$f, $$props, $$slots);
  Astro2.self = $$SpriteProvider;
  const content = await Astro2.slots.render("default");
  return renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${markHTMLString(content)}` })}
${renderComponent($$result, "Spritesheet", $$Spritesheet, {})}
`;
});

createMetadata("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Sprite.astro", { modules: [{ module: $$module1$4, specifier: "./constants", assert: {} }, { module: $$module2$7, specifier: "./utils.ts", assert: {} }, { module: $$module3$3, specifier: "./context.ts", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$e = createAstro("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-icon/lib/Sprite.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Sprite = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$e, $$props, $$slots);
  Astro2.self = $$Sprite;
  let { name, pack, title, class: className, x, y, ...inputProps } = Astro2.props;
  const props = normalizeProps(inputProps);
  if (pack) {
    name = `${pack}:${name}`;
  }
  const href = `#${SPRITESHEET_NAMESPACE}:${name}`;
  trackSprite($$result, name);
  return renderTemplate`${maybeRenderHead($$result)}<svg${spreadAttributes(props)}${addAttribute(className, "class")}${addAttribute(name, "astro-icon")}>
    ${title ? renderTemplate`<title>${title}</title>` : ""}
    <use${spreadAttributes({ "xlink:href": href, width: props.width, height: props.height, x, y })}></use>
</svg>`;
});

const deprecate = (component, message) => {
  return (...args) => {
    console.warn(message);
    return component(...args);
  };
};
const Spritesheet = deprecate(
  $$Spritesheet,
  `Direct access to <Spritesheet /> has been deprecated! Please wrap your contents in <Sprite.Provider> instead!`
);
const SpriteSheet = deprecate(
  $$Spritesheet,
  `Direct access to <SpriteSheet /> has been deprecated! Please wrap your contents in <Sprite.Provider> instead!`
);
const Sprite = Object.assign($$Sprite, { Provider: $$SpriteProvider });

const $$module2$6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Icon,
  Icon: $$Icon,
  Spritesheet,
  SpriteSheet,
  SpriteProvider: $$SpriteProvider,
  Sprite
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$c = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/compatibility-list.astro", { modules: [{ module: $$module2$6, specifier: "astro-icon", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$d = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/compatibility-list.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$CompatibilityList = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$d, $$props, $$slots);
  Astro2.self = $$CompatibilityList;
  const { title, data, url } = Astro2.props;
  return renderTemplate`${maybeRenderHead($$result)}<div class="w-full max-w-6xl space-y-2">
  <div class="relative px-6 pt-8 pb-4 border bg-offset border-default">
    <h3 class="absolute top-0 px-4 py-1 text-xs tracking-tight uppercase -translate-y-1/2 border border-current rounded-full right-4 bg-default">
      ${title}
    </h3>
    <ul class="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-6">
      ${data.map(({ title: title2, icon, url: url2 }) => renderTemplate`<li>
            <a class="flex flex-col items-center gap-2"${addAttribute(url2, "href")} target="_blank">
              ${renderComponent($$result, "Icon", $$Icon, { "class": "h-12", "name": icon })}
              <span>${title2}</span>
            </a>
          </li>`)}
    </ul>
  </div>
</div>`;
});

const $$file$c = "/Users/jason/Workspace/astro-landing/src/components/compatibility-list.astro";
const $$url$c = undefined;

const $$module2$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$c,
  default: $$CompatibilityList,
  file: $$file$c,
  url: $$url$c
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$b = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/compatibility.astro", { modules: [{ module: $$module1$5, specifier: "~/components/content-section.astro", assert: {} }, { module: $$module2$5, specifier: "~/components/compatibility-list.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$c = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/compatibility.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Compatibility = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$c, $$props, $$slots);
  Astro2.self = $$Compatibility;
  const frameworks = [
    {
      title: "React",
      icon: "fa-brands:react",
      url: "https://reactjs.org/"
    },
    {
      title: "Vue",
      icon: "fa-brands:vuejs",
      url: "https://vuejs.org/"
    },
    {
      title: "Next",
      icon: "frameworks/next",
      url: "https://nextjs.org/"
    },
    {
      title: "Astro",
      icon: "frameworks/logomark",
      url: "https://www.astro.build/"
    },
    {
      title: "Node",
      icon: "fa-brands:node-js",
      url: "https://nodejs.org/en/"
    },
    {
      title: "Express",
      icon: "frameworks/express",
      url: "https://expressjs.com/"
    }
  ];
  const languages = [
    {
      title: "JavaScript",
      icon: "fa-brands:js",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
    },
    {
      title: "HTML5",
      icon: "fa-brands:html5",
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML"
    },
    {
      title: "CSS3",
      icon: "fa-brands:css3-alt",
      url: "https://www.w3schools.com/cssref/"
    },
    {
      title: "GraphQL",
      icon: "platforms/graphql",
      url: "https://graphql.org/"
    },
    {
      title: "GitHub",
      icon: "fa-brands:github",
      url: "https://www.github.com/"
    },
    {
      title: "AWS",
      icon: "fa-brands:aws",
      url: "https://aws.amazon.com/"
    }
  ];
  return renderTemplate`${renderComponent($$result, "ContentSection", $$ContentSection, { "title": "Tech Stack", "id": "stack" }, { "default": () => renderTemplate`${renderComponent($$result, "CompatibilityList", $$CompatibilityList, { "title": "Frameworks", "data": frameworks, "url": "https://docs.astro.build/core-concepts/framework-components/" })}${renderComponent($$result, "CompatibilityList", $$CompatibilityList, { "title": "Other", "data": languages, "url": "https://docs.astro.build/guides/deploy/" })}`, "lead": () => renderTemplate`${renderComponent($$result, "Fragment", Fragment, { "slot": "lead" }, { "default": () => renderTemplate`
    I have working ${maybeRenderHead($$result)}<span class="text-primary">experience</span> with many ${" "}<span class="text-primary">frameworks</span>
    and other <span class="text-primary">technologies</span>.
    Here are a few but I've worked on projects with <span class="text-primary">many more</span>.
  ` })}` })}`;
});

const $$file$b = "/Users/jason/Workspace/astro-landing/src/components/compatibility.astro";
const $$url$b = undefined;

const $$module1$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$b,
  default: $$Compatibility,
  file: $$file$b,
  url: $$url$b
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$a = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/footer.astro", { modules: [{ module: $$module2$6, specifier: "astro-icon", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$b = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/footer.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$b, $$props, $$slots);
  Astro2.self = $$Footer;
  const links = [
    {
      url: "https://www.linkedin.com/in/jason-sy/",
      description: "LinkedIn Profile",
      icon: "mdi:linkedin"
    },
    {
      url: "https://github.com/jasnsy",
      description: "Jason on GitHub",
      icon: "fa-brands:github-alt"
    },
    {
      url: "https://twitter.com/jsytech",
      description: "Jason on Twitter",
      icon: "fa-brands:twitter"
    },
    {
      url: "https://instagram.com/jsytech",
      description: "Jason on Twitter",
      icon: "fa-brands:instagram"
    }
  ];
  return renderTemplate`${maybeRenderHead($$result)}<footer class="relative flex items-center justify-center h-64">
  <div class="absolute inset-0 overflow-hidden opacity-40">
  </div>
  <ul class="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
    ${links.map((link) => renderTemplate`<li>
          <a class="flex items-center justify-center w-16 h-16 p-4 border-2 border-current rounded-full"${addAttribute(link.url, "href")} target="_blank">
            <span class="sr-only">${link.description}</span>
            ${renderComponent($$result, "Icon", $$Icon, { "class": "h-full", "name": link.icon })}
          </a>
        </li>`)}
  </ul>
</footer>`;
});

const $$file$a = "/Users/jason/Workspace/astro-landing/src/components/footer.astro";
const $$url$a = undefined;

const $$module3$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$a,
  default: $$Footer,
  file: $$file$a,
  url: $$url$a
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$9 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/theme-switcher.astro", { modules: [{ module: $$module2$6, specifier: "astro-icon", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [{ type: "inline", value: `
  const themes = ["light", "dark"];
  const button = document.querySelector("#theme-switcher");

  const getThemeCurrent = () => document.documentElement.dataset.theme;
  const getThemeNext = () => {
    const themeCurrent = getThemeCurrent();
    const indexThemeCurrent = themes.indexOf(themeCurrent);
    return themes[(indexThemeCurrent + 1) % themes.length];
  };

  const updateIcon = () => {
    const themeCurrent = getThemeCurrent();
    document
      .querySelector(\`#icon-theme-\${themeCurrent}\`)
      .classList.add("hidden");
    const themeNext = getThemeNext();
    document
      .querySelector(\`#icon-theme-\${themeNext}\`)
      .classList.remove("hidden");
  };

  button.addEventListener("click", () => {
    const themeNext = getThemeNext();
    document.documentElement.dataset.theme = themeNext;
    localStorage.setItem("theme", themeNext);
    updateIcon();
  });

  updateIcon();
` }] });
const $$Astro$a = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/theme-switcher.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$ThemeSwitcher = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$a, $$props, $$slots);
  Astro2.self = $$ThemeSwitcher;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`<!--
  negative margin is sum of button width (8) and gap size of flex parent (6)
  TODO don't hardcode these values
-->${maybeRenderHead($$result)}<button id="theme-switcher" type="button" class="scale-0 transition-all origin-[right_center] duration-500 -ml-14 astro-QW5OU4EC">
  <div id="icon-theme-light" class="astro-QW5OU4EC">
    ${renderComponent($$result, "Icon", $$Icon, { "name": "theme/light", "class": "h-8 astro-QW5OU4EC" })}
    <span class="sr-only astro-QW5OU4EC">Use light theme</span>
  </div>
  <div id="icon-theme-dark" class="hidden astro-QW5OU4EC">
    ${renderComponent($$result, "Icon", $$Icon, { "name": "theme/dark", "class": "h-8 astro-QW5OU4EC" })}
    <span class="sr-only astro-QW5OU4EC">Use dark theme</span>
  </div>
</button>



`;
});

const $$file$9 = "/Users/jason/Workspace/astro-landing/src/components/theme-switcher.astro";
const $$url$9 = undefined;

const $$module2$4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$9,
  default: $$ThemeSwitcher,
  file: $$file$9,
  url: $$url$9
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$8 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/header.astro", { modules: [{ module: $$module2$6, specifier: "astro-icon", assert: {} }, { module: $$module2$4, specifier: "~/components/theme-switcher.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [{ type: "inline", value: `
  import MicroModal from "micromodal";

  const menuModalId = "menu-modal";

  const header: HTMLElement = document.querySelector("#page-header");
  const page = document.documentElement;
  const menu = document.querySelector(\`#\${menuModalId} ul\`);
  const openNavButton = document.querySelector("#open-nav-button");
  const closeNavButton = document.querySelector("#close-nav-button");

  const openMenu = () => {
    MicroModal.show(menuModalId, { disableScroll: true });
  };

  const closeMenu = () => {
    MicroModal.close(menuModalId);
  };

  openNavButton.addEventListener("click", openMenu);
  closeNavButton.addEventListener("click", closeMenu);

  document.addEventListener("scroll", () => {
    const d = page.clientHeight - page.scrollTop - header.offsetHeight;
    header.classList.toggle("fixed-header", d < 0);
  });

  menu.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).tagName === "A") {
      closeMenu();
    }
  });
` }] });
const $$Astro$9 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/header.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$9, $$props, $$slots);
  Astro2.self = $$Header;
  const navItems = [
    { title: "About", url: "#intro" },
    { title: "Stack", url: "#stack" },
    { title: "Projects", url: "#projects" }
  ];
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<header id="page-header" class="absolute bottom-0 z-10 flex items-center justify-between w-full px-8 py-4 text-white border-b border-transparent astro-ZCFWPM6I">
  <a class="flex items-baseline gap-3 hover:!text-default astro-ZCFWPM6I" href="#">
    <h1 class="sr-only astro-ZCFWPM6I">JSy</h1>
    <div class="monogram astro-ZCFWPM6I">JSy</div>
    <!-- <div class="font-bold">.dev</div> -->
  </a>
  <div class="astro-ZCFWPM6I">
    <div class="flex items-center gap-6 astro-ZCFWPM6I">
      <nav class="hidden sm:block astro-ZCFWPM6I">
        <ul class="flex items-center gap-6 astro-ZCFWPM6I">
          ${navItems.map(({ title, url }) => renderTemplate`<li class="astro-ZCFWPM6I">
                <a class="text-sm astro-ZCFWPM6I"${addAttribute(url, "href")}>
                  ${title}
                </a>
              </li>`)}
        </ul>
      </nav>
      <button id="open-nav-button" type="button" class="btn sm:hidden astro-ZCFWPM6I" aria-label="Navigation">
        ${renderComponent($$result, "Icon", $$Icon, { "pack": "mdi", "name": "menu", "class": "h-8 astro-ZCFWPM6I" })}
      </button>
      ${renderComponent($$result, "ThemeSwitcher", $$ThemeSwitcher, { "class": "astro-ZCFWPM6I" })}
    </div>
    <div id="menu-modal" class="hidden modal astro-ZCFWPM6I" aria-hidden="true">
      <div class="fixed inset-0 px-8 py-4 bg-default text-default astro-ZCFWPM6I">
        <div class="space-y-4 astro-ZCFWPM6I" role="dialog" aria-modal="true">
          <header class="text-right astro-ZCFWPM6I">
            <button id="close-nav-button" type="button" class="btn astro-ZCFWPM6I" aria-label="Close navigation">
              ${renderComponent($$result, "Icon", $$Icon, { "pack": "mdi", "name": "close", "class": "h-8 astro-ZCFWPM6I" })}
            </button>
          </header>
          <div class="flex justify-center astro-ZCFWPM6I">
            <div class="monogram astro-ZCFWPM6I">JSy</div>
          </div>
          <nav class="astro-ZCFWPM6I">
            <ul class="flex flex-col astro-ZCFWPM6I">
              ${navItems.map(({ title, url }) => renderTemplate`<li class="astro-ZCFWPM6I">
                    <a class="block py-4 text-xl text-center astro-ZCFWPM6I"${addAttribute(url, "href")}>
                      ${title}
                    </a>
                  </li>`)}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  </div>
</header>



<noscript>
  <style>
    #open-nav-button {
      display: none;
    }
  </style>
</noscript>

`;
});

const $$file$8 = "/Users/jason/Workspace/astro-landing/src/components/header.astro";
const $$url$8 = undefined;

const $$module4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$8,
  default: $$Header,
  file: $$file$8,
  url: $$url$8
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$7 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/intro.astro", { modules: [{ module: $$module1$5, specifier: "~/components/content-section.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$8 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/intro.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Intro = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$Intro;
  return renderTemplate`${renderComponent($$result, "ContentSection", $$ContentSection, { "title": "About", "id": "intro" }, { "lead": () => renderTemplate`${renderComponent($$result, "Fragment", Fragment, { "slot": "lead" }, { "default": () => renderTemplate`
    Hey there! My name is Jason Sy and I'm a seasoned 
    ${maybeRenderHead($$result)}<span class="text-primary">full stack developer</span> located 
    in Alberta, <span class="text-primary">Canada</span>.
    I have extensive experience creating 
    <span class="text-primary"> modern</span> websites and applications for 
    reputable <span class="text-primary">large scale</span> companies.
  ` })}` })}`;
});

const $$file$7 = "/Users/jason/Workspace/astro-landing/src/components/intro.astro";
const $$url$7 = undefined;

const $$module5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$7,
  default: $$Intro,
  file: $$file$7,
  url: $$url$7
}, Symbol.toStringTag, { value: 'Module' }));

const defaultOptions$1 = {
  outputDir: "public/assets/images",
  urlPath: "/assets/images"
};
function generateImage(src, options) {
  const settings = Object.assign(defaultOptions$1, options);
  (async () => {
    await Image__default(src, settings);
  })();
  return Image__default.statsSync(src, settings);
}

const $$module2$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  generateImage
}, Symbol.toStringTag, { value: 'Module' }));

const cjs = createRequire(import.meta.url);
const sharp = cjs("sharp");
const DataURIParser = cjs("datauri/parser");
const cache = {};
const defaultOptions = {
  quality: 60,
  outputDir: "src/assets/placeholders"
};
async function generatePlaceholder(src, options = defaultOptions) {
  options = Object.assign({}, defaultOptions, options);
  options.outputDir = options.outputDir.endsWith("/") ? options.outputDir : options.outputDir + "/";
  const hash = getHash({ path: src, options });
  try {
    const existingFile = readFileSync(options.outputDir + hash + ".placeholder", {
      encoding: "utf-8"
    });
    return JSON.parse(existingFile);
  } catch (err) {
    if (err.code === "ENOENT") {
      return await getDataURI(src, hash, options);
    }
  }
}
function getHash(options) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(options));
  return hash.digest("base64url").substring(0, 5);
}
async function getDataURI(src, hash, options) {
  if (cache[src] && cache[src].quality === options.quality) {
    return cache[src];
  }
  const image = await sharp(src);
  const imageMetadata = await image.metadata();
  const placeholderDimension = getBitmapDimensions(imageMetadata.width, imageMetadata.height, options.quality);
  const buffer = await image.rotate().resize(placeholderDimension.width, placeholderDimension.height).png().toBuffer();
  const parser = new DataURIParser();
  const data = {
    dataURI: parser.format(".png", buffer).content,
    width: imageMetadata.width,
    height: imageMetadata.height,
    quality: options.quality
  };
  cache[src] = data;
  mkdir(options.outputDir, { recursive: true }, (err) => {
    if (err) {
      console.error(err);
    }
    writeFile(options.outputDir + hash + ".placeholder", JSON.stringify(data), (err2) => {
      if (err2) {
        console.error(err2);
      }
    });
  });
  return data;
}
function getBitmapDimensions(imgWidth, imgHeight, pixelTarget) {
  const ratioWH = imgWidth / imgHeight;
  let bitmapHeight = pixelTarget / ratioWH;
  bitmapHeight = Math.sqrt(bitmapHeight);
  const bitmapWidth = pixelTarget / bitmapHeight;
  return { width: Math.round(bitmapWidth), height: Math.round(bitmapHeight) };
}

const $$module3$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  generatePlaceholder
}, Symbol.toStringTag, { value: 'Module' }));

createMetadata("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-eleventy-img/src/Image.astro", { modules: [{ module: Image, specifier: "@11ty/eleventy-img", assert: {} }, { module: $$module2$3, specifier: "./main", assert: {} }, { module: $$module3$1, specifier: "./placeholder", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$7 = createAstro("/@fs/Users/jason/Workspace/astro-landing/node_modules/astro-eleventy-img/src/Image.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Image = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Image;
  const { src, alt, caption, options = {}, sizes = "", classes = void 0, quality = 90, placeholderOptions = {} } = Astro2.props;
  const image = generateImage(
    src,
    Object.assign(options, {
      widths: [null],
      formats: ["avif", "webp", "png"],
      sharpWebpOptions: {
        quality
      },
      sharpAvifOptions: {
        quality
      }
    })
  );
  const placeHolder = await generatePlaceholder(src, placeholderOptions);
  const imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
    style: `background-size: cover;background-image:url(${placeHolder?.dataURI})`,
    onload: `this.style.backgroundImage='none'`
  };
  const html = Image__default.generateHTML(image, imageAttributes);
  const props = {
    class: classes
  };
  return renderTemplate`${maybeRenderHead($$result)}<figure${spreadAttributes(props)}>
	${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${markHTMLString(html)}` })}
	${caption && renderTemplate`<figcaption>${caption}</figcaption>`}
</figure>`;
});

const $$module1$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  generateImage,
  generatePlaceholder,
  Image: $$Image
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$6 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/showcase-card.astro", { modules: [{ module: $$module1$1, specifier: "astro-eleventy-img", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$6 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/showcase-card.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$ShowcaseCard = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$ShowcaseCard;
  const { title, image, url } = Astro2.props;
  const widths = [450, 800];
  const sizes = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";
  const { webp, avif, png } = generateImage(image, {
    widths,
    formats: ["webp", "avif", "png"],
    outputDir: "public/assets/images/showcase",
    urlPath: "/assets/images/showcase"
  });
  const avifSrcset = avif.map(({ srcset }) => srcset).join(",");
  const webpSrcset = webp.map(({ srcset }) => srcset).join(",");
  const pngSrcset = png.map(({ srcset }) => srcset).join(",");
  const placeholder = await generatePlaceholder(image, {
    outputDir: "src/assets/placeholders/showcase"
  });
  return renderTemplate`${maybeRenderHead($$result)}<a class="group aspect-video hover:!text-default"${addAttribute(url, "href")} target="_blank">
  <figure class="relative w-full h-full overflow-hidden">
    <picture>
      <source type="image/avif"${addAttribute(avifSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
      <source type="image/webp"${addAttribute(webpSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
      <source type="image/png"${addAttribute(pngSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
      <img class="object-cover w-full h-full transition-all duration-300 bg-cover group-hover:scale-110 group-hover:opacity-20 group-focus:scale-110 group-focus:opacity-20"${addAttribute(png[0].url, "src")}${addAttribute(png[0].width, "width")}${addAttribute(png[0].height, "height")} loading="lazy" decoding="async" onload="this.style.backgroundImage='none'"${addAttribute(`background-image: url(${placeholder.dataURI});`, "style")}${addAttribute(`A screenshot of ${url}`, "alt")}>
    </picture>
    <figcaption class="absolute inset-0">
      <div class="flex flex-col items-center justify-center h-full gap-2 transition-all duration-300 opacity-0 group-hover:opacity-100 group-focus:opacity-100">
        <h3 class="text-xl font-extrabold text-center uppercase">
          ${title}
        </h3>
        <p class="px-4 py-2 border border-current">${url}</p>
      </div>
    </figcaption>
  </figure>
</a>`;
});

const $$file$6 = "/Users/jason/Workspace/astro-landing/src/components/showcase-card.astro";
const $$url$6 = undefined;

const $$module2$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$6,
  default: $$ShowcaseCard,
  file: $$file$6,
  url: $$url$6
}, Symbol.toStringTag, { value: 'Module' }));

const sites = [
	{
		title: "Wordle Clone",
		image: "src/data/showcase/images/werdle.png",
		url: "https://jasnsy.github.io/werdle/"
	},
	{
		title: "TypeScript TicTacToe",
		image: "src/data/showcase/images/tictactoe.png",
		url: "https://github.com/jasnsy/tic-tac-toe"
	}
];

const $$module3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: sites
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$5 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/showcase.astro", { modules: [{ module: $$module1$5, specifier: "~/components/content-section.astro", assert: {} }, { module: $$module2$2, specifier: "~/components/showcase-card.astro", assert: {} }, { module: $$module3, specifier: "~/data/showcase/sites.json", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$5 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/showcase.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Showcase = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Showcase;
  return renderTemplate`${renderComponent($$result, "ContentSection", $$ContentSection, { "title": "Projects", "id": "projects" }, { "default": () => renderTemplate`${maybeRenderHead($$result)}<div class="max-w-6xl space-y-2">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      ${sites.map(({ title, image, url }) => renderTemplate`${renderComponent($$result, "ShowcaseCard", $$ShowcaseCard, { "title": title, "image": image, "url": url })}`)}
    </div>
    <p class="text-sm text-right">
      <a class="text-primary" href="https://github.com/jasnsy">
        ...and more &rarr;
      </a>
    </p>
  </div>`, "lead": () => renderTemplate`${renderComponent($$result, "Fragment", Fragment, { "slot": "lead" }, { "default": () => renderTemplate`
    Aside from my <span class="text-primary">portfolio</span> website, which you are currently on.
    Here are some mini side <span class="text-primary">projects</span> I've created for 
    <span class="text-primary">fun</span> and <span class="text-primary">practice</span>.
  ` })}` })}`;
});

const $$file$5 = "/Users/jason/Workspace/astro-landing/src/components/showcase.astro";
const $$url$5 = undefined;

const $$module6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$5,
  default: $$Showcase,
  file: $$file$5,
  url: $$url$5
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$4 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/starfield.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [{ type: "inline", value: `
  const COUNT = 800;
  const SPEED = 0.1;

  class Star {
    x: number;
    y: number;
    z: number;
    xPrev: number;
    yPrev: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.xPrev = x;
      this.yPrev = y;
    }

    update(width: number, height: number, speed: number) {
      this.xPrev = this.x;
      this.yPrev = this.y;
      this.z += speed * 0.0675;
      this.x += this.x * (speed * 0.0225) * this.z;
      this.y += this.y * (speed * 0.0225) * this.z;
      if (
        this.x > width / 2 ||
        this.x < -width / 2 ||
        this.y > height / 2 ||
        this.y < -height / 2
      ) {
        this.x = Math.random() * width - width / 2;
        this.y = Math.random() * height - height / 2;
        this.xPrev = this.x;
        this.yPrev = this.y;
        this.z = 0;
      }
    }

    draw(ctx: CanvasRenderingContext2D) {
      ctx.lineWidth = this.z;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.xPrev, this.yPrev);
      ctx.stroke();
    }
  }

  const stars = Array.from({ length: COUNT }, () => new Star(0, 0, 0));
  let rafId = 0;

  const canvas: HTMLCanvasElement = document.querySelector("#starfield-canvas");
  const ctx = canvas.getContext("2d");

  const container = document.querySelector("#starfield");
  const resizeObserver = new ResizeObserver(setup);
  resizeObserver.observe(container);

  function setup() {
    rafId > 0 && cancelAnimationFrame(rafId);
    const { clientWidth: width, clientHeight: height } = container;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = \`\${width}px\`;
    canvas.style.height = \`\${height}px\`;
    ctx.scale(dpr, dpr);

    for (const star of stars) {
      star.x = Math.random() * width - width / 2;
      star.y = Math.random() * height - height / 2;
      star.z = 0;
    }

    ctx.translate(width / 2, height / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = "white";
    rafId = requestAnimationFrame(frame);
  }

  function frame() {
    const { clientWidth: width, clientHeight: height } = container;

    for (const star of stars) {
      star.update(width, height, SPEED);
      star.draw(ctx);
    }

    ctx.fillRect(-width / 2, -height / 2, width, height);
    rafId = requestAnimationFrame(frame);
  }
` }] });
const $$Astro$4 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/starfield.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Starfield = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Starfield;
  return renderTemplate`${maybeRenderHead($$result)}<div id="starfield" class="absolute inset-0">
  <canvas id="starfield-canvas"></canvas>
</div>

`;
});

const $$file$4 = "/Users/jason/Workspace/astro-landing/src/components/starfield.astro";
const $$url$4 = undefined;

const $$module1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$4,
  default: $$Starfield,
  file: $$file$4,
  url: $$url$4
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$3 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/hero-image.astro", { modules: [{ module: $$module1$1, specifier: "astro-eleventy-img", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$3 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/hero-image.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$HeroImage = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$HeroImage;
  const widths = [450, 800, 1200];
  const sizes = "100vw";
  const { webp, avif, jpeg } = generateImage("src/assets/moon.jpg", {
    widths,
    formats: ["webp", "avif", "jpeg"],
    outputDir: "public/assets/images/hero",
    urlPath: "/assets/images/hero"
  });
  const avifSrcset = avif.map(({ srcset }) => srcset).join(",");
  const webpSrcset = webp.map(({ srcset }) => srcset).join(",");
  const jpegSrcset = jpeg.map(({ srcset }) => srcset).join(",");
  return renderTemplate`${maybeRenderHead($$result)}<picture>
  <source type="image/avif"${addAttribute(avifSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
  <source type="image/webp"${addAttribute(webpSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
  <source type="image/jpeg"${addAttribute(jpegSrcset, "srcset")}${addAttribute(sizes, "sizes")}>
  <img class="object-cover w-full h-full"${addAttribute(jpeg[1].url, "src")}${addAttribute(jpeg[1].width, "width")}${addAttribute(jpeg[1].height, "height")} alt="The ridged surface of the moon">
</picture>`;
});

const $$file$3 = "/Users/jason/Workspace/astro-landing/src/components/hero-image.astro";
const $$url$3 = undefined;

const $$module2$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$3,
  default: $$HeroImage,
  file: $$file$3,
  url: $$url$3
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$2 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/splash.astro", { modules: [{ module: $$module1, specifier: "~/components/starfield.astro", assert: {} }, { module: $$module2$1, specifier: "~/components/hero-image.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$2 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/splash.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Splash = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Splash;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<section class="relative h-full bg-black astro-7BUGNZLQ">
  ${renderComponent($$result, "Starfield", $$Starfield, { "class": "astro-7BUGNZLQ" })}
  <div id="splash-bg-fallback" class="absolute inset-0 hidden opacity-40 astro-7BUGNZLQ">
    ${renderComponent($$result, "HeroImage", $$HeroImage, { "class": "astro-7BUGNZLQ" })}
  </div>
  <div class="relative grid h-full sm:grid-cols-2 place-items-center astro-7BUGNZLQ">
    <h2 class="flex flex-col self-end gap-1 sm:gap-1 sm:self-auto astro-7BUGNZLQ">
      <div class="font-extrabold tracking-tighter text-center text-8xl astro-7BUGNZLQ">
        Jason Sy
      </div>
      <div class="text-primary font-extrabold tracking-tighter text-2xl astro-7BUGNZLQ">
        Full Stack Developer
      </div>
    </h2>
  </div>
</section>

<noscript>
  <style>
    #splash-bg-fallback {
      display: block;
    }
  </style>
</noscript>

`;
});

const $$file$2 = "/Users/jason/Workspace/astro-landing/src/components/splash.astro";
const $$url$2 = undefined;

const $$module7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$2,
  default: $$Splash,
  file: $$file$2,
  url: $$url$2
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$1 = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/components/features.astro", { modules: [{ module: $$module1$5, specifier: "~/components/content-section.astro", assert: {} }, { module: $$module2$6, specifier: "astro-icon", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$1 = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/components/features.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Features = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Features;
  const features = [
    {
      title: "Bring Your Own Framework",
      description: "Build your site using React, Svelte, Vue, Preact, web components, or just plain ol' HTML + JavaScript.",
      icon: "mdi:handshake"
    },
    {
      title: "100% Static HTML, No JS",
      description: "Astro renders your entire page to static HTML, removing all JavaScript from your final build by default.",
      icon: "mdi:feather"
    },
    {
      title: "On-Demand Components",
      description: "Need some JS? Astro can automatically hydrate interactive components when they become visible on the page. If the user never sees it, they never load it.",
      icon: "mdi:directions-fork"
    },
    {
      title: "Broad Integration",
      description: "Astro supports TypeScript, Scoped CSS, CSS Modules, Sass, Tailwind, Markdown, MDX, and any of your favorite npm packages.",
      icon: "mdi:graph"
    },
    {
      title: "SEO Enabled",
      description: "Automatic sitemaps, RSS feeds, pagination and collections take the pain out of SEO and syndication.",
      icon: "mdi:search-web"
    },
    {
      title: "Community",
      description: "Astro is an open source project powered by hundreds of contributors making thousands of individual contributions.",
      icon: "mdi:account-group"
    }
  ];
  return renderTemplate`${renderComponent($$result, "ContentSection", $$ContentSection, { "title": "Features", "id": "features" }, { "default": () => renderTemplate`${maybeRenderHead($$result)}<ul class="grid max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    ${features.map(({ title, description, icon }) => renderTemplate`<li class="flex flex-col items-center gap-4 p-6 border border-default bg-offset">
          <div class="w-16 h-16 p-3 border-2 border-current rounded-full">
            ${renderComponent($$result, "Icon", $$Icon, { "name": icon })}
          </div>
          <p class="text-xl font-extrabold text-center">${title}</p>
          <p class="text-sm text-center text-offset">${description}</p>
        </li>`)}
  </ul>`, "lead": () => renderTemplate`${renderComponent($$result, "Fragment", Fragment, { "slot": "lead" }, { "default": () => renderTemplate`
    Astro comes <span class="text-primary">batteries included</span>. It takes
    the best parts of
    <span class="text-primary">state-of-the-art</span>
    tools and adds its own <span class="text-primary">innovations</span>.
  ` })}` })}`;
});

const $$file$1 = "/Users/jason/Workspace/astro-landing/src/components/features.astro";
const $$url$1 = undefined;

const $$module2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$1,
  default: $$Features,
  file: $$file$1,
  url: $$url$1
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$metadata = createMetadata("/@fs/Users/jason/Workspace/astro-landing/src/pages/index.astro", { modules: [{ module: $$module1$2, specifier: "~/components/compatibility.astro", assert: {} }, { module: $$module2, specifier: "~/components/features.astro", assert: {} }, { module: $$module3$2, specifier: "~/components/footer.astro", assert: {} }, { module: $$module4, specifier: "~/components/header.astro", assert: {} }, { module: $$module5, specifier: "~/components/intro.astro", assert: {} }, { module: $$module6, specifier: "~/components/showcase.astro", assert: {} }, { module: $$module7, specifier: "~/components/splash.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro = createAstro("/@fs/Users/jason/Workspace/astro-landing/src/pages/index.astro", "https://astro-moon-landing.netlify.app/", "file:///Users/jason/Workspace/astro-landing/");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const { site } = Astro2;
  const image = new URL("social.jpg", site);
  const description = "Jason Sy's Personal Website";
  return renderTemplate(_a || (_a = __template(['<html lang="en" class="h-full motion-safe:scroll-smooth" data-theme="dark">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width">\n\n    <title>Jason Sy Portfolio</title>\n    <meta name="description"', `>

    <!-- fonts -->
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap" media="print" onload="this.media='all'">
    `, '<noscript>\n      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap">\n    </noscript>\n\n    <!-- social media -->\n    <meta property="og:title" content="portfolio">\n    <meta property="og:type" content="website">\n    <meta property="og:description"', '>\n    <meta property="og:image"', '>\n    <meta property="og:url"', '>\n    <meta name="twitter:card" content="summary_large_image">\n\n    <!-- initialize theme -->\n    <script>\n      const themeSaved = localStorage.getItem("theme");\n\n      if (themeSaved) {\n        document.documentElement.dataset.theme = themeSaved;\n      } else {\n        const prefersDark = window.matchMedia(\n          "(prefers-color-scheme: dark)"\n        ).matches;\n        document.documentElement.dataset.theme = prefersDark ? "dark" : "light";\n      }\n\n      window\n        .matchMedia("(prefers-color-scheme: dark)")\n        .addEventListener("change", (event) => {\n          if (!localStorage.getItem("theme")) {\n            document.documentElement.dataset.theme = event.matches\n              ? "dark"\n              : "light";\n          }\n        });\n    <\/script>\n  ', '</head>\n  <body class="h-full overflow-x-hidden text-base bg-default text-default selection:bg-secondary selection:text-white">\n    ', "\n    ", '\n    <div class="px-8 py-32 space-y-24">\n      ', "\n      ", "\n      ", "\n    </div>\n    ", "\n  </body></html>"])), addAttribute(description, "content"), maybeRenderHead($$result), addAttribute(description, "content"), addAttribute(image, "content"), addAttribute(site, "content"), renderHead($$result), renderComponent($$result, "Header", $$Header, {}), renderComponent($$result, "Splash", $$Splash, {}), renderComponent($$result, "Intro", $$Intro, {}), renderComponent($$result, "Compatibility", $$Compatibility, {}), renderComponent($$result, "Showcase", $$Showcase, {}), renderComponent($$result, "Footer", $$Footer, {}));
});

const $$file = "/Users/jason/Workspace/astro-landing/src/pages/index.astro";
const $$url = "";

const _page0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const pageMap = new Map([['src/pages/index.astro', _page0],]);
const renderers = [Object.assign({"name":"astro:jsx","serverEntrypoint":"astro/jsx/server.js","jsxImportSource":"astro"}, { ssr: server_default }),];

if (typeof process !== "undefined") {
  if (process.argv.includes("--verbose")) ; else if (process.argv.includes("--silent")) ; else ;
}

const SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".ts"]);
new RegExp(
  `\\.(${Array.from(SCRIPT_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

const STYLE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".css",
  ".pcss",
  ".postcss",
  ".scss",
  ".sass",
  ".styl",
  ".stylus",
  ".less"
]);
new RegExp(
  `\\.(${Array.from(STYLE_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return segment[0].spread ? `/:${segment[0].content.slice(3)}(.*)?` : "/" + segment.map((part) => {
      if (part)
        return part.dynamic ? `:${part.content}` : part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  return {
    ...serializedManifest,
    assets,
    routes
  };
}

const _manifest = Object.assign(deserializeManifest({"adapterName":"@astrojs/vercel/serverless","routes":[{"file":"","links":["assets/index.32c313d9.css"],"scripts":[{"type":"external","value":"hoisted.b2d89190.js"}],"routeData":{"route":"/","type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","_meta":{"trailingSlash":"ignore"}}}],"site":"https://astro-moon-landing.netlify.app/","base":"/","markdown":{"drafts":false,"syntaxHighlight":"shiki","shikiConfig":{"langs":[],"theme":"github-dark","wrap":false},"remarkPlugins":[],"rehypePlugins":[],"remarkRehype":{},"extendDefaultPlugins":false,"isAstroFlavoredMd":false},"pageMap":null,"renderers":[],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.js","/astro/hoisted.js?q=0":"hoisted.b2d89190.js","astro:scripts/before-hydration.js":"data:text/javascript;charset=utf-8,//[no before-hydration script]"},"assets":["/assets/index.32c313d9.css","/favicon.ico","/favicon.svg","/hoisted.b2d89190.js","/social.jpg","/assets/images/astronaut/yLnzHhqALK-450.avif","/assets/images/astronaut/yLnzHhqALK-450.png","/assets/images/astronaut/yLnzHhqALK-450.webp","/assets/images/astronaut/yLnzHhqALK-800.avif","/assets/images/astronaut/yLnzHhqALK-800.png","/assets/images/astronaut/yLnzHhqALK-800.webp","/assets/images/hero/gDdfI9LZ83-1200.avif","/assets/images/hero/gDdfI9LZ83-1200.jpeg","/assets/images/hero/gDdfI9LZ83-1200.webp","/assets/images/hero/gDdfI9LZ83-450.avif","/assets/images/hero/gDdfI9LZ83-450.jpeg","/assets/images/hero/gDdfI9LZ83-450.webp","/assets/images/hero/gDdfI9LZ83-800.avif","/assets/images/hero/gDdfI9LZ83-800.jpeg","/assets/images/hero/gDdfI9LZ83-800.webp","/assets/images/hero/zNPh6foJwQ-1200.avif","/assets/images/hero/zNPh6foJwQ-1200.jpeg","/assets/images/hero/zNPh6foJwQ-1200.webp","/assets/images/hero/zNPh6foJwQ-450.avif","/assets/images/hero/zNPh6foJwQ-450.jpeg","/assets/images/hero/zNPh6foJwQ-450.webp","/assets/images/hero/zNPh6foJwQ-800.avif","/assets/images/hero/zNPh6foJwQ-800.jpeg","/assets/images/hero/zNPh6foJwQ-800.webp","/assets/images/showcase/VBzvsHZFNn-450.avif","/assets/images/showcase/VBzvsHZFNn-450.png","/assets/images/showcase/VBzvsHZFNn-450.webp","/assets/images/showcase/VBzvsHZFNn-800.avif","/assets/images/showcase/VBzvsHZFNn-800.png","/assets/images/showcase/VBzvsHZFNn-800.webp","/assets/images/showcase/XL4LjefiVn-450.avif","/assets/images/showcase/XL4LjefiVn-450.png","/assets/images/showcase/XL4LjefiVn-450.webp","/assets/images/showcase/XL4LjefiVn-800.avif","/assets/images/showcase/XL4LjefiVn-800.png","/assets/images/showcase/XL4LjefiVn-800.webp","/assets/images/showcase/XsJjJNVoLY-450.avif","/assets/images/showcase/XsJjJNVoLY-450.png","/assets/images/showcase/XsJjJNVoLY-450.webp","/assets/images/showcase/XsJjJNVoLY-800.avif","/assets/images/showcase/XsJjJNVoLY-800.png","/assets/images/showcase/XsJjJNVoLY-800.webp","/assets/images/showcase/Yu0_jHmtiW-348.avif","/assets/images/showcase/Yu0_jHmtiW-348.png","/assets/images/showcase/Yu0_jHmtiW-348.webp","/assets/images/showcase/_IPbM6qIYI-450.avif","/assets/images/showcase/_IPbM6qIYI-450.png","/assets/images/showcase/_IPbM6qIYI-450.webp","/assets/images/showcase/_IPbM6qIYI-800.avif","/assets/images/showcase/_IPbM6qIYI-800.png","/assets/images/showcase/_IPbM6qIYI-800.webp","/assets/images/showcase/g9vYzfI0uj-450.avif","/assets/images/showcase/g9vYzfI0uj-450.png","/assets/images/showcase/g9vYzfI0uj-450.webp","/assets/images/showcase/g9vYzfI0uj-800.avif","/assets/images/showcase/g9vYzfI0uj-800.png","/assets/images/showcase/g9vYzfI0uj-800.webp","/assets/images/showcase/kZtoOWPTn5-450.avif","/assets/images/showcase/kZtoOWPTn5-450.png","/assets/images/showcase/kZtoOWPTn5-450.webp","/assets/images/showcase/kZtoOWPTn5-800.avif","/assets/images/showcase/kZtoOWPTn5-800.png","/assets/images/showcase/kZtoOWPTn5-800.webp","/assets/images/showcase/yA2q_yIsp6-450.avif","/assets/images/showcase/yA2q_yIsp6-450.png","/assets/images/showcase/yA2q_yIsp6-450.webp","/assets/images/showcase/yA2q_yIsp6-800.avif","/assets/images/showcase/yA2q_yIsp6-800.png","/assets/images/showcase/yA2q_yIsp6-800.webp","/assets/images/showcase/yC-dmJk7dD-450.avif","/assets/images/showcase/yC-dmJk7dD-450.png","/assets/images/showcase/yC-dmJk7dD-450.webp","/assets/images/showcase/yC-dmJk7dD-800.avif","/assets/images/showcase/yC-dmJk7dD-800.png","/assets/images/showcase/yC-dmJk7dD-800.webp"]}), {
	pageMap: pageMap,
	renderers: renderers
});
const _args = undefined;

const _exports = adapter.createExports(_manifest, _args);
const _default = _exports['default'];

const _start = 'start';
if(_start in adapter) {
	adapter[_start](_manifest, _args);
}

export { _default as default };
