/**
 * @name    Get-Google-Fonts
 * @author  Maciej (Maxie) Mieńko
 * @license Apache-2.0
 */
const Q             = require('q')
const URL           = require('url')
const parseUrl      = url => URL.parse(url,true,true)
const path          = require('path')
const fs            = require('fs')
const mkdirp        = require('mkdirp')
const request       = require('request')
const normalizeUrl  = require('normalize-url')

const REGULAR_EXPRESSIONS = {
	face:   /\s*(?:\/\*\s*(.*?)\s*\*\/)?[^@]*?@font-face\s*{(?:[^}]*?)}\s*/gi,
	family: /font-family\s*:\s*(?:\'|")?([^;]*?)(?:\'|")?\s*;/i,
	weight: /font-weight\s*:\s*([^;]*?)\s*;/i,
	url:    /url\s*\(\s*(?:\'|")?\s*([^]*?)\s*(?:\'|")?\s*\)\s*?/gi
}
const DEFAULT_CONFIG = {
	outputDir:  './fonts',
	path:       './',
	template:   '{family}-{weight}-{comment}{i}.{ext}',
	cssFile:    'fonts.css',
	userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
							'(KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
	overwriting: false,
	verbose:     false,
	simulate:    false
}

/**
 * Replace in-string variables with their values from given object
 * @param  {String} template
 * @param  {Object} values
 * @return {String}
 */
function format(template, values) {
	return Object
		.entries(values)
		.filter(
			([key]) => /^[a-z0-9_-]+$/gi.test(key)
		)
		.map(
			([key, value]) =>
				[new RegExp(`([^{]|^){${key}}([^}]|$)`,'g'), `$1${value}$2`]
		)
		.reduce(
			(str, [regexp, replacement]) => {
				return str.replace(regexp, replacement)
			}, template
		)
		.replace(/({|}){2}/g, '$1')
}
/**
 * Allows to filter config object
 * @param  {Object} config
 * @return {Object}
 */
function filterConfig(config) {
	return Object
		.entries(config)
		.filter(
			([key, value]) =>
				typeof value === typeof DEFAULT_CONFIG[key]
		)
		.reduce(
			(obj, [key, value]) => {
				obj[key] = value
				return obj
			}, {}
		)
}
/**
 * Download given url to string
 * @param  {String}  url
 * @return {Promise}
 */
function downloadString(url, {userAgent}) {
	let deferred  = Q.defer()
	let startTime = Date.now()
	let data = ''
	request({
		method: 'GET',
		url: url,
		headers: {
			'User-Agent': userAgent
		}
	}, function(error, response, body) {
		if(error) {
			deferred.reject(new Error(error))
			return;
		}
		deferred.resolve({
			time: Date.now() - startTime,
			result: body,
			statusCode: response.statusCode
		})
	})
	return deferred.promise
}
/**
 * Array parser helper
 * @param  {Mixed}  arrayLike
 * @param  {String} delimiter
 * @return {Array}
 */
function arrayFrom(arrayLike, delimiter=',') {
	if(typeof arrayLike === 'string')
		return arrayLike.split(delimiter)
	return Array.from(arrayLike)
}
/**
 * Normalize given URL
 * @param  {String} url
 * @return {String}
 */
function repairUrl(url) {
	return normalizeUrl(url
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#039;/gi, '\'')
	)
		.trim()
		.replace(/\s+/g,'+')
}
/**
 * @param  {RegExp} regexp
 * @return {RegExp}
 */
function cloneRegExp(regexp) {
	return new RegExp(regexp.source, regexp.flags)
}
/**
 * @param  {String} name
 * @return {RegExp}
 */
function getRegExp(name) {
	return cloneRegExp(
		REGULAR_EXPRESSIONS[name] || new Regexp('','')
	)
}
/**
 * @return {Object}
 */
function getAllRegExp() {
	return Object
		.entries(REGULAR_EXPRESSIONS)
		.reduce((obj, [key, regexp]) => {
			obj[key] = cloneRegExp(regexp)
			return obj
		}, {})
}
/**
 * @param  {Object} config
 * @param  {String} css
 * @return {Array}
 */
function transformCss(config, css) {
	let fonts = []
	let replacements = []
	let re = getAllRegExp()
	let i = 1

	while((match1 = re.face.exec(css)) !== null) {
		[fontface, comment] = match1;
		[, family]   = re.family.exec(fontface);
		[, weight]   = re.weight.exec(fontface)
		// Clone for reset lastIndex
		let re_url   = cloneRegExp(re.url)
		while((match2 = re.url.exec(fontface)) !== null) {
			[forReplace, url] = match2
			let urlPathname = parseUrl(url).pathname
			let ext         = path.extname(urlPathname)
			let filename    = path.basename(urlPathname, ext)
			let newFilename = format(config.template, {
				 comment: comment  || '',
				  family: family   || '',
				  weight: weight   || '',
				filename: filename || '',
				     ext: ext.replace(/^\./,'') || '',
						   i: i++
			}).replace(/\.$/,'')
			fonts.push({
				 input: url,
				output: newFilename
			})
			replacements.push({
				 input: forReplace,
				output: `url('${config.path}${newFilename}')`
			})
		}
	}

	replacements
		.forEach(({input, output}) => {
			css = css.replace(input, output)
		})

	return [css, fonts]
}
/**
 * @param  {Object} config
 * @param  {Array}  css_fonts_url
 * @return {Arrau}
 */
function normalizeFonts(config, [css, fonts, url]) {
	return [
		css,
		fonts.map(({input, output}) => {
			return {
				 input: URL.resolve(url, input),
				output: output
			}
		})
	]
}
/**
 * Save files
 * @param  {Object} config
 * @param  {Array}  css_fonts
 * @return {Object}
 */
function saveFiles(config, [css, fonts]) {
	if(!config.simulate)
		mkdirp(config.outputDir)
	let res = Q()
	fonts
		.forEach(({input, output}) => {
			res = res.then(() => {
				let deferred  = Q.defer()
				if(config.verbose)
					console.log(`Saving ${output}`)
				let req = request({
					url: input,
					header: {
						'User-Agent': config.userAgent
					}
				})
				.on('error', e => {
					deferred.reject(new Error(e))
				})
				.on('response', res => {
					deferred.resolve()
				})
				let file = path.resolve(config.outputDir, output)
				if(!config.simulate
				&&(config.overwriting
				  || !fs.existsSync(file)))
					req.pipe(fs.createWriteStream(file))
				return deferred.promise
			})
		})
	res.then(() => {
		let deferred  = Q.defer()
		let file = path.resolve(config.outputDir, config.cssFile)
		if(config.verbose)
			console.log(`Saving ${path.basename(config.cssFile)}`)
		if(!config.simulate&&(config.overwriting||!fs.existsSync(file))) {
			fs.writeFile(file, css, 'utf8', e => {
				if(e) {
					deferred.reject(new Error(e))
					return;
				}
				deferred.resolve()
			})
		} else deferred.resolve()
		return deferred.promise
	})
	return res
}

module.exports = class GetGoogleFonts {
	/**
	 * @param {Object} config
	 */
	constructor(config={}) {
		this.setConfig(config)
	}
	/**
	 * Set new config
	 * @param  {Object}  config
	 * @param  {Boolean} reset
	 * @return {Object}
	 */
	setConfig(config={}, reset=true) {
		this.config = filterConfig(Object.assign(
			{},
			DEFAULT_CONFIG,
			reset ? {} : this.config,
			config
		))
		return this
	}
	/**
	 * @return {Object}
	 */
	getConfig() {
		return filterConfig(Object.assign(
			{}, DEFAULT_CONFIG, this.config
		))
	}
	/**
	 * @param  {String} url
	 * @param  {Object} config
	 * @return {Array}
	 */
	repairInput(url, config={}) {
		if(url instanceof Array === false
		&& typeof url !== 'string')
			throw new TypeError('URL must be an array or string')
		return [
			Array.isArray(url) ? this.constructor.constructUrl(...url) : repairUrl(url),
			filterConfig(Object.assign(
				{}, DEFAULT_CONFIG, this.config,
				config instanceof Object ? config : {}
			))
		]
	}
	/**
	 * Generate URL based on given data
	 * @param  {Object} families
	 * @param  {Array}  subsets
	 * @return {String}
	 */
	static constructUrl(families={}, subsets=[]) {
		if(families instanceof Object === false)
			families = {}
		families = Object
			.entries(families)
			.map(([family, weights]) =>
				[
					String(family)
						.trim()
						.replace(/\s+/g, '+')
						.replace(/[^a-z0-9+-_]/gi,''),
					arrayFrom(weights,',')
						.map(weight => weight.trim())
						.filter(weight => /^\d{3}i?$/.test(weight))
				]
			)
			.reduce((newFamilies, [thisFamily, thisWeights]) => {
				// Reduce non-unique fonts
				let found = false
				newFamilies.forEach(([family, weights], index) => {
					if(family === thisFamily) {
						found = true
						newFamilies[index][1] = [...weights, ...thisWeights]
							.filter( (weight, index, arr) => arr.indexOf(weight) === index )
					}
				})
				if(!found)
					newFamilies.push([thisFamily, thisWeights])
				return newFamilies
			}, [])
			.map(([family, weights]) =>
				[
					family,
					weights.join(',').trim()
				]
				.filter(x => x.length)
				.join(':')
			)
			.join('|')
		subsets = arrayFrom(subsets)
			.map(subset => subset.trim().toLowerCase())
			.filter(subset => /[a-z-]+/.test(subset))
			.join(',')
		return `https://fonts.googleapis.com/css?family=${families}&subset=${subsets}`
			.replace('?family=&','?')
			.replace(/subset=$/,'')
	}
	/**
	 * Download given fonts
	 * @param  {String|Array} url
	 * @param  {Object}       config
	 * @return {Promise}
	 */
	download(url, config={}) {
		[url, config] = this.repairInput(url, config)
		let timeStart = Date.now()
		if(config.verbose)
			console.log(`Downloading CSS from URL: ${url}`)
		return downloadString(url, config)
			.then(({time, statusCode, result}) => {
				if(config.verbose)
					console.log(`Downloaded CSS with status code: ${statusCode} in ${time}ms`)
				return statusCode >= 400 ? '' : result
			})
			.then(transformCss.bind(null, config))
			.then(([css, fonts]) => {
				if(config.verbose)
					console.log(`Found reference to ${fonts.length} fonts`)
				return [css, fonts, url]
			})
			.then(normalizeFonts.bind(null, config))
			.then(saveFiles.bind(null, config))
			.then(x => {
				if(config.verbose)
					console.log(`Done in ${Date.now() - timeStart}ms`)
				return x
			})
	}
}