import * as Chat2Gen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as BotsGen from '../../../actions/bots-gen'
import * as Constants from '../../../constants/chat2'
import * as TeamConstants from '../../../constants/teams'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import {InfoPanel, Panel, ParticipantTyp} from '.'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as TeamTypes from '../../../constants/types/teams'
import flags from '../../../util/feature-flags'

// TODO this container does a ton of stuff for the various tabs. Really the tabs should be connected
// and this thing is just a holder of tabs

type OwnProps = {
  loadDelay?: number
  conversationIDKey: Types.ConversationIDKey
  onBack?: () => void
  onCancel?: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
  onSelectAttachmentView: (typ: RPCChatTypes.GalleryItemTyp) => void
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp
}

const getFromMsgID = (info: Types.AttachmentViewInfo): Types.MessageID | null => {
  if (info.last || info.status !== 'success') {
    return null
  }
  const lastMessage = info.messages.length > 0 ? info.messages[info.messages.length - 1] : null
  return lastMessage ? lastMessage.id : null
}

const noAttachmentView = Constants.makeAttachmentViewInfo()
const noDocs = {docs: [], onLoadMore: () => {}, status: 'loading'}
const noLinks = {links: [], onLoadMore: () => {}, status: 'loading'}
const noMedia = {onLoadMore: () => {}, status: 'loading', thumbs: []}

const ConnectedInfoPanel = Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    const meta = Constants.getMeta(state, conversationIDKey)

    let admin = false
    let canEditChannel = false
    let canSetMinWriterRole = false
    let canSetRetention = false
    let canDeleteHistory = false
    if (meta.teamname) {
      const yourOperations = TeamConstants.getCanPerform(state, meta.teamname)
      admin = yourOperations.manageMembers
      canEditChannel = yourOperations.editTeamDescription
      canSetMinWriterRole = yourOperations.setMinWriterRole
      canSetRetention = yourOperations.setRetentionPolicy
      canDeleteHistory = yourOperations.deleteChatHistory && !meta.cannotWrite
    } else {
      canDeleteHistory = true
    }
    const isPreview = meta.membershipType === 'youArePreviewing'
    const selectedTab = ownProps.selectedTab || (meta.teamname ? 'members' : 'attachments')
    const selectedAttachmentView = ownProps.selectedAttachmentView || RPCChatTypes.GalleryItemTyp.media
    const m = state.chat2.attachmentViewMap.get(conversationIDKey)
    const attachmentInfo = (m && m.get(selectedAttachmentView)) || noAttachmentView
    const attachmentsLoading = selectedTab === 'attachments' && attachmentInfo.status === 'loading'
    const _teamMembers =
      state.teams.teamNameToMembers.get(meta.teamname) || new Map<string, TeamTypes.MemberInfo>()

    return {
      _attachmentInfo: attachmentInfo,
      _botAliases: meta.botAliases,
      _featuredBots: state.chat2.featuredBotsMap,
      _fromMsgID: getFromMsgID(attachmentInfo),
      _infoMap: state.users.infoMap,
      _nameParticipants: meta.nameParticipants,
      _participantToContactName: meta.participantToContactName,
      _participants: meta.participants,
      _team: meta.teamname,
      _teamMembers,
      _username: state.config.username,
      adhocTeam: meta.teamType === 'adhoc',
      admin,
      attachmentsLoading,
      canDeleteHistory,
      canEditChannel,
      canSetMinWriterRole,
      canSetRetention,
      channelname: meta.channelname,
      description: meta.descriptionDecorated,
      ignored: meta.status === RPCChatTypes.ConversationStatus.ignored,
      isPreview,
      loadedAllBots: state.chat2.featuredBotsLoaded,
      selectedAttachmentView,
      selectedConversationIDKey: conversationIDKey,
      selectedTab,
      smallTeam: meta.teamType !== 'big',
      spinnerForHide: Container.anyWaiting(
        state,
        Constants.waitingKeyConvStatusChange(ownProps.conversationIDKey)
      ),
      teamname: meta.teamname,
    }
  },
  (
    dispatch: Container.TypedDispatch,
    {conversationIDKey, onBack, onCancel, onSelectAttachmentView}: OwnProps
  ) => ({
    _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox()),
    _onDocDownload: (message: Types.Message) => dispatch(Chat2Gen.createAttachmentDownload({message})),
    _onEditChannel: (teamname: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamname}, selected: 'chatEditChannel'}],
        })
      ),
    _onLoadMore: (viewType: RPCChatTypes.GalleryItemTyp, fromMsgID?: Types.MessageID) =>
      dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, fromMsgID, viewType})),
    _onMediaClick: (message: Types.MessageAttachment) =>
      dispatch(Chat2Gen.createAttachmentPreviewSelect({message})),
    _onShowBlockConversationDialog: (others: Array<string>, team: string) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {blockByDefault: true, convID: conversationIDKey, others, team},
              selected: 'chatBlockingModal',
            },
          ],
        })
      )
    },
    _onShowClearConversationDialog: () => {
      dispatch(Chat2Gen.createNavigateToThread())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
        })
      )
    },
    _onShowInFinder: (message: Types.MessageAttachment) =>
      message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath})),
    onAttachmentViewChange: (viewType: RPCChatTypes.GalleryItemTyp) => {
      dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType}))
      onSelectAttachmentView(viewType)
    },
    onBack: onBack
      ? () => {
          onBack()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
    onCancel: onCancel
      ? () => {
          onCancel()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
    onHideConv: () => dispatch(Chat2Gen.createHideConversation({conversationIDKey})),
    onJoinChannel: () => dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
    onLeaveConversation: () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
    onLoadMoreBots: () => dispatch(Chat2Gen.createLoadNextBotPage({pageSize: 6})),
    onSearchFeaturedBots: (query: string) => dispatch(BotsGen.createSearchFeaturedBots({query})),
    onShowNewTeamDialog: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {conversationIDKey},
              selected: 'chatShowNewTeamDialog',
            },
          ],
        })
      )
    },
    onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
    onUnhideConv: () => dispatch(Chat2Gen.createUnhideConversation({conversationIDKey})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    let participants = stateProps._participants
    const botUsernames = participants.filter(
      // If we're in an adhoc team, get bots by finding participants not in nameParticipants
      p =>
        stateProps.adhocTeam
          ? !stateProps._nameParticipants.includes(p)
          : TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p, 'restrictedbot') ||
            TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p, 'bot')
    )

    participants = flags.botUI ? participants.filter(p => !botUsernames.includes(p)) : participants

    const bots: Array<RPCTypes.FeaturedBot> = botUsernames.map(
      b =>
        stateProps._featuredBots.get(b) ?? {
          botAlias: stateProps._botAliases[b] ?? (stateProps._infoMap.get(b) || {fullname: ''}).fullname,
          botUsername: b,
          description: stateProps._infoMap.get(b)?.bio ?? '',
          extendedDescription: '',
        }
    )

    const availableBots = Array.from(stateProps._featuredBots.entries())
      .filter(([k, _]) => !botUsernames.includes(k))
      .map(([_, v]) => v)

    const teamMembers = stateProps._teamMembers
    const isGeneral = stateProps.channelname === 'general'
    const showAuditingBanner = isGeneral && !teamMembers
    const membersForBlock = (stateProps._teamMembers.size
      ? [...stateProps._teamMembers.keys()]
      : stateProps._participants
    ).filter(username => username !== stateProps._username && !Constants.isAssertion(username))
    if (teamMembers && isGeneral) {
      participants = [...teamMembers.values()].reduce<Array<string>>((l, mi) => {
        l.push(mi.username)
        return l
      }, [])

      if (flags.botUI) {
        participants = participants.filter(p => !botUsernames.includes(p))
      }
    }
    return {
      admin: stateProps.admin,
      attachmentsLoading: stateProps.attachmentsLoading,
      availableBots,
      bots,
      canDeleteHistory: stateProps.canDeleteHistory,
      canEditChannel: stateProps.canEditChannel,
      canSetMinWriterRole: stateProps.canSetMinWriterRole,
      canSetRetention: stateProps.canSetRetention,
      channelname: stateProps.channelname,
      customCancelText: 'Done',
      description: stateProps.description,
      docs:
        stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.doc
          ? {
              docs: (stateProps._attachmentInfo.messages as Array<Types.MessageAttachment>) // TODO dont use this cast
                .map(m => ({
                  author: m.author,
                  ctime: m.timestamp,
                  downloading: m.transferState === 'downloading',
                  fileName: m.fileName,
                  message: m,
                  name: m.title || m.fileName,
                  onDownload:
                    !Container.isMobile && !m.downloadPath
                      ? () => dispatchProps._onDocDownload(m)
                      : () => null,
                  onShowInFinder:
                    !Container.isMobile && m.downloadPath ? () => dispatchProps._onShowInFinder(m) : null,
                  progress: m.transferProgress,
                })),
              onLoadMore: stateProps._fromMsgID
                ? () =>
                    dispatchProps._onLoadMore(
                      RPCChatTypes.GalleryItemTyp.doc,
                      stateProps._fromMsgID ?? undefined
                    )
                : null,
              status: stateProps._attachmentInfo.status,
            }
          : noDocs,
      ignored: stateProps.ignored,
      isPreview: stateProps.isPreview,
      links:
        stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.link
          ? {
              links: stateProps._attachmentInfo.messages.reduce<
                Array<{author: string; ctime: number; snippet: string; title?: string; url?: string}>
              >((l, m) => {
                if (m.type !== 'text') {
                  return l
                }
                if (!m.unfurls.size) {
                  l.push({
                    author: m.author,
                    ctime: m.timestamp,
                    snippet: (m.decoratedText && m.decoratedText.stringValue()) || '',
                  })
                } else {
                  ;[...m.unfurls.values()].forEach(u => {
                    if (u.unfurl.unfurlType === RPCChatTypes.UnfurlType.generic && u.unfurl.generic) {
                      l.push({
                        author: m.author,
                        ctime: m.timestamp,
                        snippet: (m.decoratedText && m.decoratedText.stringValue()) || '',
                        title: u.unfurl.generic.title,
                        url: u.unfurl.generic.url,
                      })
                    }
                  })
                }
                return l
              }, []),
              onLoadMore: stateProps._fromMsgID
                ? () =>
                    dispatchProps._onLoadMore(
                      RPCChatTypes.GalleryItemTyp.link,
                      stateProps._fromMsgID ?? undefined
                    )
                : null,
              status: stateProps._attachmentInfo.status,
            }
          : noLinks,
      loadDelay: ownProps.loadDelay,
      loadedAllBots: stateProps.loadedAllBots,
      media:
        stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.media
          ? {
              onLoadMore: stateProps._fromMsgID
                ? () =>
                    dispatchProps._onLoadMore(
                      RPCChatTypes.GalleryItemTyp.media,
                      stateProps._fromMsgID ?? undefined
                    )
                : null,
              status: stateProps._attachmentInfo.status,
              thumbs: (stateProps._attachmentInfo.messages as Array<Types.MessageAttachment>) // TODO dont use this cast
                .map(m => ({
                  ctime: m.timestamp,
                  height: m.previewHeight,
                  isVideo: !!m.videoDuration,
                  onClick: () => dispatchProps._onMediaClick(m),
                  previewURL: m.previewURL,
                  width: m.previewWidth,
                })),
            }
          : noMedia,
      onAttachmentViewChange: dispatchProps.onAttachmentViewChange,
      onBack: dispatchProps.onBack,
      onCancel: dispatchProps.onCancel,
      onEditChannel: () => dispatchProps._onEditChannel(stateProps.teamname),
      onHideConv: dispatchProps.onHideConv,
      onJoinChannel: dispatchProps.onJoinChannel,
      onLeaveConversation: dispatchProps.onLeaveConversation,
      onLoadMoreBots: dispatchProps.onLoadMoreBots,
      onSearchFeaturedBots: dispatchProps.onSearchFeaturedBots,
      onSelectTab: ownProps.onSelectTab,
      onShowBlockConversationDialog: membersForBlock.length
        ? () => dispatchProps._onShowBlockConversationDialog(membersForBlock, stateProps._team)
        : dispatchProps.onHideConv,
      onShowClearConversationDialog: () => dispatchProps._onShowClearConversationDialog(),
      onShowNewTeamDialog: dispatchProps.onShowNewTeamDialog,
      onShowProfile: dispatchProps.onShowProfile,
      onUnhideConv: dispatchProps.onUnhideConv,
      participants: participants
        .map(p => ({
          fullname:
            (stateProps._infoMap.get(p) || {fullname: ''}).fullname ||
            stateProps._participantToContactName.get(p) ||
            '',
          isAdmin: stateProps.teamname
            ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'admin')
            : false,
          isOwner: stateProps.teamname
            ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'owner')
            : false,
          username: p,
        }))
        .sort((l: ParticipantTyp, r: ParticipantTyp) => {
          const leftIsAdmin = l.isAdmin || l.isOwner
          const rightIsAdmin = r.isAdmin || r.isOwner
          if (leftIsAdmin && !rightIsAdmin) {
            return -1
          } else if (!leftIsAdmin && rightIsAdmin) {
            return 1
          }
          return l.username.localeCompare(r.username)
        }),
      selectedAttachmentView: stateProps.selectedAttachmentView,
      selectedConversationIDKey: stateProps.selectedConversationIDKey,
      selectedTab: stateProps.selectedTab,
      showAuditingBanner,
      smallTeam: stateProps.smallTeam,
      spinnerForHide: stateProps.spinnerForHide,
      teamname: stateProps.teamname,
    }
  }
  // TODO fix this type
)(InfoPanel) as any

type SelectorOwnProps = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  tab: Panel | null
  attachmentview: RPCChatTypes.GalleryItemTyp
}>

type Props = {
  conversationIDKey: Types.ConversationIDKey
  initialTab: Panel | null
  onBack: () => void
  onGoToInbox: () => void
  shouldNavigateOut: boolean
}

const InfoPanelSelector = (props: Props) => {
  const {shouldNavigateOut, onGoToInbox, onBack} = props
  const prevShouldNavigateOut = Container.usePrevious(props.shouldNavigateOut)
  React.useEffect(() => {
    !prevShouldNavigateOut && shouldNavigateOut && onGoToInbox()
  }, [prevShouldNavigateOut, shouldNavigateOut, onGoToInbox])
  const [selectedTab, onSelectTab] = React.useState<Panel | null>(props.initialTab)
  const [selectedAttachmentView, onSelectAttachmentView] = React.useState<RPCChatTypes.GalleryItemTyp>(
    RPCChatTypes.GalleryItemTyp.media
  )
  const [show, setShow] = React.useState<boolean>(true)
  const onDestroyed = React.useCallback(() => {
    onBack()
  }, [onBack])

  if (!props.conversationIDKey) {
    return null
  }

  return Container.isMobile ? (
    <ConnectedInfoPanel
      onBack={undefined}
      onCancel={props.onBack}
      conversationIDKey={props.conversationIDKey}
      onSelectTab={onSelectTab}
      selectedTab={selectedTab}
      onSelectAttachmentView={onSelectAttachmentView}
      selectedAttachmentView={selectedAttachmentView}
    />
  ) : (
    <Kb.Box onClick={() => setShow(false)} style={styles.clickCatcher}>
      <Kb.Transition
        items={show}
        keys={item => (item ? 'showing' : 'hiding')}
        config={(showing, state) => ({duration: showing && state == 'enter' ? 200 : 50})}
        from={{...styles.panelContainer, right: -320}}
        enter={{...styles.panelContainer, right: 0}}
        leave={{...styles.panelContainer, right: -320}}
        onDestroyed={onDestroyed}
      >
        {show => style => {
          return show ? (
            <Kb.animated.div style={style} onClick={(evt: React.BaseSyntheticEvent) => evt.stopPropagation()}>
              <ConnectedInfoPanel
                loadDelay={400}
                onBack={() => setShow(false)}
                onSelectTab={onSelectTab}
                conversationIDKey={props.conversationIDKey}
                selectedTab={selectedTab}
                onSelectAttachmentView={onSelectAttachmentView}
                selectedAttachmentView={selectedAttachmentView}
              />
            </Kb.animated.div>
          ) : null
        }}
      </Kb.Transition>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clickCatcher: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 39,
      },
      panelContainer: {
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        right: 0,
        top: 40,
        width: 320,
      },
    } as const)
)

const InfoConnected = Container.connect(
  (state, ownProps: SelectorOwnProps) => {
    const conversationIDKey: Types.ConversationIDKey = Container.getRouteProps(
      ownProps,
      'conversationIDKey',
      Constants.noConversationIDKey
    )
    const meta = Constants.getMeta(state, conversationIDKey)
    return {
      conversationIDKey,
      shouldNavigateOut: meta.conversationIDKey === Constants.noConversationIDKey,
    }
  },
  dispatch => ({
    // Used by HeaderHoc.
    onBack: () => dispatch(Chat2Gen.createToggleInfoPanel()),
    onGoToInbox: () => dispatch(Chat2Gen.createNavigateToInbox()),
  }),
  (stateProps, dispatchProps, ownProps: SelectorOwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    initialTab: Container.getRouteProps(ownProps, 'tab', null),
    onBack: dispatchProps.onBack,
    onGoToInbox: dispatchProps.onGoToInbox,
    shouldNavigateOut: stateProps.shouldNavigateOut,
  })
)(InfoPanelSelector)

export default InfoConnected
