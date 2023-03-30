import axios from "axios";
import fs from "fs";
const capabilities = JSON.parse(fs.readFileSync("src/util/capabilities.json").toString());


enum FeatureLevel {
    None = 0,
    Basic = 1,
    Featured = 2
}

async function lookupCapability(url : string) {
    let response = await axios.get(url);
    return response.data;
}

export default async function parse(url : string) {
    let capability = await lookupCapability(url);


    let featureLevel = FeatureLevel.None;

    let allOfficialFeatures : string[] = [];
    let allExtras : any[] = [];
    let allPartials : any[] = [];

    if (capability?.features?.full && typeof capability.features.full === "object") {
        // Is array?
        console.log("Checking full features")
        if (!Array.isArray(capability.features.full)) throw new Error("Malformed capability manifest");
        capability.features.full.forEach(feature => {
            if (typeof feature === "string") allOfficialFeatures.push(feature);
            else if (typeof feature === "object") allExtras.push(feature);
        })
    } else {
        throw new Error("Malformed capability manifest");
    }

    if (capability?.features?.partial && typeof capability.features.partial === "object") {
        // Is array?
        if (!Array.isArray(capability.features.partial)) throw new Error("Malformed capability manifest");
        capability.features.full.forEach(feature => {
            if (typeof feature === "object" && !Array.isArray(feature)) allPartials.push(feature);
        })
    }

    let allMissing : string[] = [];

    capabilities.all.forEach(feature => {
        if (!allOfficialFeatures.includes(feature) && !allPartials.some(f => f.feature === feature)) allMissing.push(feature);
    })

    featureLevel = FeatureLevel.Featured;

    let allMissingForFeatured : string[] = [];

    capabilities.featureLevels.Featured.forEach(feature => {
        if (!allOfficialFeatures.includes(feature)) {
            featureLevel = FeatureLevel.Basic;
            allMissingForFeatured.push(feature);
        }
    })

    let allMissingForBasic : string[] = [];

    capabilities.featureLevels.Basic.forEach(feature => {
        if (!allOfficialFeatures.includes(feature)) {
            featureLevel = FeatureLevel.None;
            allMissingForBasic.push(feature);
        }
    })

    return {
        featureLevel,
        featureLevelKey: Object.keys(FeatureLevel).find(key => FeatureLevel[key] === featureLevel),
        allOfficialFeatures,
        allExtras,
        allPartials,
        allMissing,
        allMissingForBasic,
        allMissingForFeatured
    }

}

(async () => {
    let client = await lookupCapability("https://raw.githubusercontent.com/vtheskeleton/quarklight/prod/capabilities.json");
    console.log(client);
})