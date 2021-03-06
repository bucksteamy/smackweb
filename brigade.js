const { events, Job, Group } = require('brigadier')

events.on("push", (brigadeEvent, project) => {
    
    // setup variables
    var gitPayload = JSON.parse(brigadeEvent.payload)
    var brigConfig = new Map()
    brigConfig.set("acrServer", project.secrets.acrServer)
    brigConfig.set("acrUsername", project.secrets.acrUsername)
    brigConfig.set("acrPassword", project.secrets.acrPassword)
    brigConfig.set("apiImage", "bucksteamy/smackweb")
    brigConfig.set("gitSHA", brigadeEvent.commit.substr(0,7))
    brigConfig.set("eventType", brigadeEvent.type)
    brigConfig.set("branch", getBranch(gitPayload))
    brigConfig.set("imageTag", `${brigConfig.get("branch")}-${brigConfig.get("gitSHA")}`)
    brigConfig.set("apiACRImage", `${brigConfig.get("acrServer")}/${brigConfig.get("apiImage")}`)
    
    console.log(`==> gitHub webook (${brigConfig.get("branch")}) with commit ID ${brigConfig.get("gitSHA")}`)
    
    // setup brigade jobs
    var golang = new Job("job-runner-golang")
    var docker = new Job("job-runner-docker")
    var helm = new Job("job-runner-helm")
    var slack = new Job("slack-notify", "technosophos/slack-notify:latest", ["/slack-notify"])
    goJobRunner(golang)
    dockerJobRunner(brigConfig, docker)
    helmJobRunner(brigConfig, helm, 100, 0, "prod")
    slackJob(slack, project.secrets.slackWebhook, `brigade pipeline starting for ${brigConfig.get("branch")} with commit ID ${brigConfig.get("gitSHA")}\ndeploying to prod and removing canary test via istio rules`)

    // start pipeline
    console.log(`==> starting pipeline for docker image: ${brigConfig.get("apiACRImage")}:${brigConfig.get("imageTag")}`)
    var pipeline = new Group()
    pipeline.add(slack)
    pipeline.add(golang)
    pipeline.add(docker)
    pipeline.add(helm)
    if (brigConfig.get("branch") == "master") {
        pipeline.runEach()
    } else {
        console.log(`==> no jobs to run when not master`)
    }  
})

events.on("pull_request", (brigadeEvent, project) => {

    // setup variables
    var gitPayload = JSON.parse(brigadeEvent.payload)
    var brigConfig = new Map()
    brigConfig.set("acrServer", project.secrets.acrServer)
    brigConfig.set("acrUsername", project.secrets.acrUsername)
    brigConfig.set("acrPassword", project.secrets.acrPassword)
    brigConfig.set("apiImage", "bucksteamy/smackweb")
    brigConfig.set("gitSHA", brigadeEvent.commit.substr(0,7))
    brigConfig.set("eventType", brigadeEvent.type)
    brigConfig.set("branch", getBranch(gitPayload))
    brigConfig.set("imageTag", `${brigConfig.get("branch")}-${brigConfig.get("gitSHA")}`)
    brigConfig.set("apiACRImage", `${brigConfig.get("acrServer")}/${brigConfig.get("apiImage")}`)
    
    console.log(`==> gitHub webook (${brigConfig.get("branch")}) with commit ID ${brigConfig.get("gitSHA")}`)

    // setup brigade jobs
    var golang = new Job("job-runner-golang")
    var docker = new Job("job-runner-docker")
    var helm = new Job("job-runner-helm")
    var slack = new Job("slack-notify", "technosophos/slack-notify:latest", ["/slack-notify"])
    goJobRunner(golang)
    dockerJobRunner(brigConfig, docker)
    helmJobRunner(brigConfig, helm, 10, 90, "new")
    slackJob(slack, project.secrets.slackWebhook, `brigade pipeline starting for ${brigConfig.get("branch")} with commit ID ${brigConfig.get("gitSHA")}\ncanary testing starting via istio\nplease review analytics`)

    // start pipeline
    console.log(`==> starting pipeline for docker image: ${brigConfig.get("apiACRImage")}:${brigConfig.get("imageTag")}`)
    var pipeline = new Group()
    pipeline.add(slack)
    pipeline.add(golang)
    pipeline.add(docker)
    pipeline.add(helm)
    pipeline.runEach()
})

events.on("after", (event, proj) => {
    console.log("brigade pipeline finished successfully")

    var slack = new Job("slack-notify", "technosophos/slack-notify:latest", ["/slack-notify"])
    slack.storage.enabled = false
    slack.env = {
      SLACK_WEBHOOK: proj.secrets.slackWebhook,
      SLACK_USERNAME: "smackweb brigade notifier",
      SLACK_MESSAGE: "brigade pipeline finished successfully",
      SLACK_COLOR: "#ff0000"
    }
	slack.run()
    
})

function goJobRunner(g) {
    // define job for golang work
    g.storage.enabled = false
    g.image = "golang:1.7.5"
    g.tasks = [
        "cd /src/",
        "go get github.com/gorilla/mux",
        "go build -o smackweb .",
        "go test -v"
    ]
}

function dockerJobRunner(config, d) {
    d.storage.enabled = false
    d.image = "chzbrgr71/dnd:v5"
    d.privileged = true
    d.tasks = [
        "dockerd-entrypoint.sh &",
        "echo waiting && sleep 20",
        "cd /src/",
        `docker login ${config.get("acrServer")} -u ${config.get("acrUsername")} -p ${config.get("acrPassword")}`,
        `docker build --build-arg BUILD_DATE='1/1/2017 5:00' --build-arg IMAGE_TAG_REF=${config.get("imageTag")} --build-arg VCS_REF=${config.get("gitSHA")} -t ${config.get("apiImage")} .`,
        `docker tag ${config.get("apiImage")} ${config.get("apiACRImage")}:${config.get("imageTag")}`,
        `docker push ${config.get("apiACRImage")}:${config.get("imageTag")}`,
        "killall dockerd"
    ]
}

function helmJobRunner (config, h, prodWeight, canaryWeight, deployType) {
    h.storage.enabled = false
    h.image = "lachlanevenson/k8s-helm:2.7.0"
    h.tasks = [
        "cd /src/",
        "apk update",
        "apk add openssl",
        `wget "https://njechartrepo.blob.core.windows.net/charts/smackweb?sv=2017-04-17&ss=b&srt=sco&sp=rwdlac&se=2018-12-19T07:50:14Z&st=2017-12-18T23:50:14Z&spr=https&sig=dGebtmipnMBCZk5vau4hw4rwkz7Nd%2FsZoXJhxD6AAGs%3D" -O smackweb.tar.gz`,
        `wget "https://njechartrepo.blob.core.windows.net/charts/routes?sv=2017-04-17&ss=b&srt=sco&sp=rwdlac&se=2018-12-19T07:50:14Z&st=2017-12-18T23:50:14Z&spr=https&sig=dGebtmipnMBCZk5vau4hw4rwkz7Nd%2FsZoXJhxD6AAGs%3D" -O routes.tar.gz`,
        "tar -xzf smackweb.tar.gz",        
        "tar -xzf routes.tar.gz",
        `helm upgrade --install smackweb-${deployType} ./smackweb --namespace draftdemo --set web.image=${config.get("apiACRImage")} --set web.imageTag=${config.get("imageTag")} --set web.deployment=smackweb-${deployType} --set web.versionLabel=${deployType}`,
        `helm upgrade --install smackweb-routes ./routes --namespace draftdemo --set prodLabel=prod --set prodWeight=${prodWeight} --set canaryLabel=new --set canaryWeight=${canaryWeight} --set serviceLabel=smackweb`
    ]
}

function slackJob (s, webhook, message) {
    s.storage.enabled = false
    s.env = {
      SLACK_WEBHOOK: webhook,
      SLACK_USERNAME: "smackweb brigade notifier",
      SLACK_MESSAGE: message,
      SLACK_COLOR: "#0000ff"
    }
}

function getBranch (p) {
    if (p.ref) {
        return p.ref.substring(11)
    } else {
        return "PR"
    }
}