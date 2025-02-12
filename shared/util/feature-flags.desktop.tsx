import {featureFlagsOverride} from '../local-debug.desktop'
import {FeatureFlags} from './feature-flags'

if (process.env['KEYBASE_FEATURES']) {
  console.error('KEYBASE_FEATURES is no longer supported. Edit the "*.app.debug" json file instead')
}

let features = (featureFlagsOverride && featureFlagsOverride.split(',')) || []

const featureOn = (key: keyof FeatureFlags) => features.includes(key)

const ff: FeatureFlags = {
  admin: false,
  airdrop: true,
  audioAttachments: false,
  botUI: false,
  chatIndexProfilingEnabled: false,
  connectThrashCheck: false,
  dbCleanEnabled: false,
  fastAccountSwitch: true,
  foldersInProfileTab: false,
  lagRadar: false,
  moveOrCopy: false,
  newTeamBuildingForChatAllowMakeTeam: false,
  outOfDateBanner: false,
  proofProviders: true,
  stellarExternalPartners: true,
  userBlocking: true,
}

const inAdmin: {[K in keyof FeatureFlags]?: boolean} = {
  audioAttachments: false,
  botUI: true,
  chatIndexProfilingEnabled: true,
  connectThrashCheck: true,
  dbCleanEnabled: true,
  moveOrCopy: true,
  outOfDateBanner: true,
  proofProviders: true,
  userBlocking: false,
}

// load overrides
Object.keys(ff).forEach(k => {
  ff[k] = featureOn(k as keyof FeatureFlags) || ff[k] || (featureOn('admin') && !!inAdmin[k])
})

if (__DEV__) {
  console.log('Features', ff)
}

export default ff
