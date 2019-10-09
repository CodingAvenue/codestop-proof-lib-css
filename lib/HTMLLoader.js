const jsdom = require('jsdom');
const fs = require('fs');
const { promisify } = require('util');
const pretty = require('pretty');
const xpath = require('xpath');
const XMLDom = require('xmldom').DOMParser;

const readFile = promisify(fs.readFile);
const access = promisify(fs.access);

class HTMLLoader {
    constructor(html, sandboxURL) {
	// TODO we need to a way to accept html strings and not force the caller to create a file first then let JSDOM read it.
	// JSDOM already allows string HTML to be pass on it's constructor.
        this.html = html;
        this.externalCSS = [];
        this.formSandboxURL = sandboxURL;
    }

    async addExternalCSS(css) {
        try {
            await access(css, fs.constants.F_OK | fs.constants.R_OK);
            const content = await readFile(css, 'utf-8');
            this.externalCSS.push(content);
        } catch(e) {
            throw e;
        }
    }

    async load(runScript = false) {
        try {
            const htmlContent = await readFile(this.html, 'utf-8');
            this.doc = new XMLDom().parseFromString(htmlContent);

            if (runScript) {
                const virtualConsole = new jsdom.VirtualConsole();
                virtualConsole.sendTo({
                    error(err, errObject) {
                        throw errObject;
                    }
                });
                this.dom = new jsdom.JSDOM(htmlContent, { "resources" : "usable", runScripts: "dangerously", virtualConsole: virtualConsole });
            } else {
                this.dom = new jsdom.JSDOM(htmlContent, { "resources" : "usable" });
            }

            // Removing <link> elements since we're not processing them.
            //const links = this.getElements("link");
            //links.forEach((link) => {
            //    link.parentNode.removeChild(link);
            //});

            // We're loading "defined" external css as a style element. Then add it inside the HEAD element.
            // It's still good to dynamically add a link.
            // Defined in here are CSS files that is part of the course. Any other CSS files added by the users
            // are ignored.
            this.externalCSS.forEach((css) => {
                const doc = this.getDocument();
                const head = doc.getElementsByTagName('head')[0];
                const style = doc.createElement("style");

                style.type = "text/css";
                style.innerHTML = css;
                head.appendChild(style);
            });
        } catch(e) {
            throw e;
        }
    }

    /**
     * Returns the document created by JSDOM
     */
    getDocument() {
        return this.getWindow().document;
    }

    /**
     * Returns the window object created by JSDOM
     */
    getWindow() {
        return this.dom.window;
    }

    /**
     * 
     * @param {string} selector 
     * @return CSSStyleDeclaration
     */
    getComputedStyle(selector, pseudoEle) {
        if (typeof selector === 'string') {
            return this.getWindow().getComputedStyle(this.getElement(selector), pseudoEle);
        } else {
            return this.getWindow().getComputedStyle(selector, pseudoEle);
        }
    }

    /**
     * Returns a NodeList of Element that matches the selector.
     * 
     * @param {string} selector 
     * @return NodeList
     */
    getElements(selector) {
        return this.getDocument().querySelectorAll(selector);
    }

    /**
     * Returns the first element that match the selector. NULL if there is no match
     * 
     * @param {string} selector 
     * @return Element|null
     */
    getElement(selector) {
        return this.getDocument().querySelector(selector);
    }

    /**
     * Returns a pretty print serialize of the dom.
     * 
     * @return String HTML string
     */
    serialize(baseUrl) {
        const imgs = this.getElements('img');

        for (var i = 0; i < imgs.length; i++) {
            const img = imgs[i];

            const src = img.getAttribute('src');
            img.setAttribute('src', `${baseUrl}${src}`);
        }

        const forms = this.getElements('form');
        
        for (var i = 0; i < forms.length; i++) {
            const form = forms[i];

            const action = form.getAttribute('action');
            form.setAttribute('action', `${baseUrl}${action}`);
        }
        
        // Add meta tag so we can set the encoding of the page. This will make sure that the iframe will use UTF8
        const doc = this.getDocument();
        const meta = doc.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Type');
        meta.setAttribute('content', 'text/html');
        meta.setAttribute('charset', 'UTF-8');
        
        doc.getElementsByTagName("head")[0].appendChild(meta)

        return pretty(this.dom.serialize());
    }

    /**
     * XPath related methods
     */

    /**
     * Find a single node that match the XPath string
     */
    findOneByXPath(xPathString, context) {
        if (!context) {
            context = this.doc;
        }

        return xpath.select1(xPathString, context);
    }

    /**
     * Find nodes that matches the XPath string.
     */
    findByXPath(xPathString, context) {
        if (!context) {
            context = this.doc;
        }

        return xpath.select(xPathString, context);
    }
}

module.exports = HTMLLoader;
