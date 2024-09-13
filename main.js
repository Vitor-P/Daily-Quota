const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const auth = require("./auth");
const fs = require("fs");

let cliente = "Augusto Cesar Medasdfdsfeiros imperial";

try {
  cliente = fs.readFileSync("./variables/tidyArr.txt", "utf8");
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

console.log(cliente);

try {
  ID = parseInt(fs.readFileSync("./variables/id.txt", "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://rhemamaquinas.com.br/admin/acesso");

  await page.type("#user", auth.user);
  await page.type("#pass", auth.pass);
  await page.click('button[type="submit"]');

  //Create Tidy Array Function
  const createTidyArray = async () => {
    try {
      // Navigate to the URL
      await page.goto("https://rhemamaquinas.com.br/admin/formulario", { waitUntil: "networkidle2" });
      await page.waitForSelector('input[aria-controls="listagem"]');

      // Type the ID value into the input element
      let idInput = await page.$('input[aria-controls="listagem"]');
      await idInput.type(`${ID}`);

      // Wait for the table to load
      await page.waitForSelector("table");

      const nextSiblingTextArray = await page.$$eval("td", (tds) =>
        tds.map((td) => {
          const nextSibling = td.nextElementSibling;
          return nextSibling ? nextSibling.textContent : "not found";
        })
      );
      // Excludes values
      const excludedValues = ["Nome", "Email", "Ações", "", "not found"];
      let tidyArr = nextSiblingTextArray.map((str) => str.trim()).filter((str) => !excludedValues.includes(str));
      // console.log(tidyArr);
      if (tidyArr.length != 0) {
        fs.writeFileSync("./variables/tidyArr.txt", tidyArr.toString());
      }
      return tidyArr;
    } catch (err) {
      console.error(err);
    }
  };

  //// Checks to see if repeated name
  let tidyArr = await createTidyArray();
  console.log(`tidyArr split: ${tidyArr}`);
  console.log(`cliente split: ${cliente}`);

  if (tidyArr.length === 0) {
    console.log(`No new quota ${new Date()}. Process ended. 🔚`);
  } else {
    console.log(`ID exists, Create Array and Update id 🟢" \n ${tidyArr}`);
    let quotaString = "";

    //While Loop
    while (tidyArr.length != 0) {
      if (tidyArr.some((el) => cliente.toLowerCase().includes(el.toLowerCase()))) {
        console.log("Repeating CLient ❌", ID);
        ID += 1;
        fs.writeFileSync("./variables/id.txt", ID.toString());
        ///////////////////////////////fs.writeFileSync("./variables/tidyArr.txt", cliente.toString()); TEST

        console.log("ID changed 🔃", ID);

        tidyArr = await createTidyArray();
      } else {
        console.log(`tidyArr: ${tidyArr}`);
        console.log(`cliente: ${cliente}`);

        await page.click(`button[title="Editar"]`);

        let sections = [
          "data_cadastro",
          "titulo_pagina",
          "produto",
          "nome",
          "empresa",
          "email",
          "telefone",
          "whatsapp",
          "pais",
          "estado",
          "cidade",
        ];

        const quota = {};

        for (const section of sections) {
          const labelElem = await page.waitForSelector(`label[for="${section}"]`);
          const elemText = await labelElem.evaluate((el) => el.textContent);
          // console.log(elemText);

          const valueSelect = await page.waitForSelector(`input[id="${section}"]`);
          const value = await valueSelect.evaluate((el) => el.value);
          // console.log(value);

          quota[elemText] = value;
        }

        const labelElem = await page.waitForSelector(`label[for="mensagem"]`);
        const elemText = await labelElem.evaluate((el) => el.textContent);
        // console.log(elemText);

        const valueSelect = await page.waitForSelector(`textarea[id="mensagem"]`);
        const value = await valueSelect.evaluate((el) => el.textContent);
        // console.log(value);

        quota[elemText] = value;
        // console.log(quota);

        let quotaSingle = `
Data Castro: ${quota["Data Cadastro:"]}
Titulo da página: ${quota["Titulo da página"]}
Nome: ${quota["Nome:"]}
Produto: ${quota["Produto:"]}
Empresa: ${quota["Empresa:"]}
Email: ${quota["Email:"]}
Telefone: ${quota["Telefone:"]}
Whatsapp: ${quota["Whatsapp:"]}
País: ${quota["Pais:"]}
Estado: ${quota["Estado:"]}
Cidade: ${quota["Cidade:"]}
Mensagem: ${quota["Mensagem:"]}
_______________________________`;

        quotaString += quotaSingle;
        ID += 1;
        try {
          cliente = fs.readFileSync("./variables/tidyArr.txt", "utf8");
        } catch (err) {
          if (err.code !== "ENOENT") {
            throw err;
          }
        }
        console.log(cliente);

        fs.writeFileSync("./variables/id.txt", ID.toString());
        // console.log(quotaString);
        console.log("ID changed ✅", ID);
        tidyArr = await createTidyArray();
      }
    }

    //Send Email
    if (quotaString === "") {
      console.log("No new Quota ❌");
    } else {
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: `${auth.gmailUser}`,
          pass: `${auth.gmailPass}`,
        },
      });

      let gmailMessage = {
        from: `${auth.gmailUser}`,
        to: `${auth.gmailReceiver}`,
        subject: "Orçamento Site",
        text: `Boa Tarde Fran, segue o orçamento do site.

            ${quotaString}
            `,
      };

      transporter.sendMail(gmailMessage, (error, info) => {
        if (error) {
          console.log("Error occurred while sending email:", error.message);
        } else {
          console.log("Message sent:", info.response);
        }
      });
    }
  }

  browser.close();
})();
