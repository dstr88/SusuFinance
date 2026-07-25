/// <reference types="astro/client" />

// Google Analytics (gtag.js) is loaded via a script tag in the layouts, so it is
// not an import — declare the globals it attaches to Window.
interface Window {
	gtag?: (...args: any[]) => void;
	dataLayer: unknown[];
}
