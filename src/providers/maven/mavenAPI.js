
const { window } = require('vscode')
const fs = require('fs');
const os = require('os');
const xmldoc = require('xmldoc');

const httpRequest = require('request-light');

const MAVEN_CENTRAL = "https://repo.maven.apache.org/maven2/"


function loadMavenRepositories() {
  const homeDir = os.homedir();
  let result = []
  return Promise.all([new Promise(function (resolve, reject) {
    let repositories = []

    fs.readFile(homeDir + "/.m2/settings.xml", (err, data) => {
      if (err) {
        repositories.push(MAVEN_CENTRAL)
      } else {
        let xml = new xmldoc.XmlDocument(data.toString());
        let repositoriesXml = xml.descendantWithPath("profiles.profile.repositories").childrenNamed("repository")

        repositoriesXml.forEach(repositoryXml => {
          repositories.push(repositoryXml.childNamed("url").val)
        })
      }
      resolve(repositories)
    })
  }), new Promise(function (resolve, reject) {
    let repositories = []

    if (window.activeTextEditor) {
      let xmlCurrentPom = new xmldoc.XmlDocument(window.activeTextEditor.document.getText())
      let repositoriesCurrentPom = xmlCurrentPom.descendantWithPath("repositories")
      if (repositoriesCurrentPom) {
        repositoriesCurrentPom.eachChild(element => {
          repositories.push(element.childNamed("url").val)
        })
      }
    }
    resolve(repositories)
  })]).then(results => {
    results.forEach(r => {
      result = result.concat(r)
    })
    return Promise.resolve(result)
  })
}

export function mavenGetPackageVersions(packageName) {
  return new Promise(function (resolve, reject) {
    loadMavenRepositories().then((repositories) => {
      let [group, artifact] = packageName.split(':');
      let search = group.replace(/\./g, "/") + "/" + artifact
      let results = []
      return Promise.all(repositories.map(element => {
        const queryUrl = `${element}${search}/maven-metadata.xml`;
        return httpRequest.xhr({ url: queryUrl })
          .then(response => {
            if (response.status != 200) {
              reject({
                status: response.status,
                responseText: response.responseText
              });
              return;
            }

            // Parse XML
            let xmlRootNode = new xmldoc.XmlDocument(response.responseText);
            let xmlVersioningNode = xmlRootNode.childNamed("versioning");
            let xmlVersionsList = xmlVersioningNode.childNamed("versions").childrenNamed("version");
            let versions = []
            xmlVersionsList.forEach(xmlVersionNode => {
              versions.push(xmlVersionNode.val);
            })
            resolve(versions);
          }).catch(reject);
      })).then(results => {
        results.forEach(r => {
          result = result.concat(r)
        })
        return Promise.resolve(result)
      })
    });
  });

}