require('dotenv').config()
const puppeteer = require('puppeteer');

(async () => {
    const browser = await initBrowser()
    const page = await goToPage(browser)

    await page.exposeFunction('log', log)
    await page.exposeFunction('sleep', sleep)

    await login(page)
    await sleep(4000)

    await page
        .waitForSelector('#qa_trading_totalInvestment')
        .then(() => log('got it'));
})();

const sleep = ms => new Promise(res => setTimeout(res, ms))
const log = text => console.log(text)

async function login(page) {
    await sleep(1500)
    await page.type(
        'vui-input-text > input[type=text]',
        process.env.BINOMO_USER
    )
    await page.type(
        'vui-input-password > input[type=password]',
        process.env.BINOMO_PASSWORD
    )
    await sleep(500)
    await page.click('#qa_auth_LoginBtn > button')
}

async function goToPage(browser) {
    const url = process.env.BINOMO_URL
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)
    await page.goto(url)
    return page
}

async function initBrowser() {
    return await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        args: [`--window-size=${1920},${1080}`]
    })
}