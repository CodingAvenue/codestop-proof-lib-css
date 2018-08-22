const jsdom = require('jsdom');
const fs = require('fs');
const { promisify } = require('util');
const pretty = require('pretty');

const readFile = promisify(fs.readFile);
const statFile = promisify(fs.stat);

class HTMLLoader {
    constructor(html) {
        this.html = html;
        this.externalCSS = [];
    }

    async addExternalCSS(css) {
        try {
            statFile(css);
            const content = await readFile(css, 'utf-8');
            this.externalCSS.push(content);
        } catch(e) {
            throw new Error(e.message);
        }
    }

    async load() {
        try {
            const htmlContent = await readFile(this.html, 'utf-8');
            this.dom = new jsdom.JSDOM(htmlContent, { "resources" : "usable" });

            // Removing <link> elements since we're not processing them.
            const links = this.getElements("link");
            links.forEach((link) => {
                link.parentNode.removeChild(link);
            });

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
            throw new Error(e.message);
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
    getComputedStyle(selector) {
        return this.getWindow().getComputedStyle(this.getElement(selector));
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
    serialize() {
        return pretty(this.dom.serialize());
    }
}

module.exports = HTMLLoader;