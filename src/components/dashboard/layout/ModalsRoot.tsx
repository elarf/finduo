import React from 'react';
import { useDashboard } from '../../../context/DashboardContext';
import CategoryModal from '../CategoryModal';
import TagModal from '../TagModal';
import TransferModal from '../TransferModal';
import DatePickerModal from '../DatePickerModal';
import IconPickerSheet from '../IconPickerSheet';
import AccountPickerSheet from '../AccountPickerSheet';
import EntryModal from '../EntryModal';
import AccountModal from '../AccountModal';
import InvitationsModal from '../InvitationsModal';
import FriendsModal from '../FriendsModal';
import QuickNavigation from '../QuickNavigation';

export default function ModalsRoot() {
  const {
    user, signOut, navigation,
    height,
    // Data
    accounts, categories, tags, hiddenCategoryIds,
    primaryAccountId, excludedAccountIds, accountSettings,
    friends, pendingRequests, friendsLoading, friendAccountMap,
    loadFriends, friendSendRequest, friendAcceptRequest, friendRejectRequest,
    friendCancelRequest, removeFriend, blockUser,
    addFriendToAccount, removeFriendFromAccount,
    reloadDashboard,
    pendingDebtCount,
    saving,
    // Modal visibility
    menuOpen, setMenuOpen,
    showEntryModal, setShowEntryModal,
    showCategoryModal, setShowCategoryModal,
    showAccountModal, setShowAccountModal,
    showTagModal, setShowTagModal,
    showInvitationsModal, setShowInvitationsModal,
    showTransferModal, setShowTransferModal,
    showFriendsModal, setShowFriendsModal,
    // Editing IDs
    editingTransactionId,
    editingCategoryId, setEditingCategoryId,
    editingAccountId,
    editingAccount,
    editingTagId,
    // Entry form
    entryType, setEntryType,
    entryAmount, setEntryAmount,
    entryDate,
    entryCategoryId, setEntryCategoryId,
    entryNote, setEntryNote,
    entryTagIds,
    newTagName, setNewTagName,
    noteFieldFocused, setNoteFieldFocused,
    entryAccountId, setEntryAccountId,
    entryAccount,
    selectedCurrency,
    entryCategories, entryTags, entryTagUsage,
    recentCategoryAmounts, noteSuggestions,
    // Category form
    categoryName, setCategoryName,
    categoryType, setCategoryType,
    categoryColor, setCategoryColor,
    categoryIcon, setCategoryIcon,
    categoryTagIds, setCategoryTagIds,
    // Tag form
    tagName, setTagName,
    tagColor, setTagColor,
    tagIcon, setTagIcon,
    // Account form
    newAccountName, setNewAccountName,
    newAccountIcon, setNewAccountIcon,
    newAccountCurrency, setNewAccountCurrency,
    settingsIncluded, setSettingsIncluded,
    settingsCarryOver, setSettingsCarryOver,
    settingsInitialBalance, setSettingsInitialBalance,
    settingsInitialDate, setSettingsInitialDate,
    accountTagIds, setAccountTagIds,
    // Invitation state
    inviteToken,
    joinToken, setJoinToken,
    invitationAccountId, setInvitationAccountId,
    inviteName, setInviteName,
    inviteExpiresDays, setInviteExpiresDays,
    editingInviteId, setEditingInviteId,
    managedInvites,
    // Transfer form
    transferFromId, setTransferFromId,
    transferToId, setTransferToId,
    transferSourceAmount,
    transferRate, setTransferRate,
    transferTargetAmount, setTransferTargetAmount,
    transferDate,
    transferNote, setTransferNote,
    // Icon/date picker
    showIconPickerSheet,
    iconPickerAnim,
    iconPickerTarget,
    iconSearchQuery, setIconSearchQuery,
    filteredIconNames,
    showDatePicker, setShowDatePicker,
    datePickerTarget,
    setTransferDate, setEntryDate,
    dpYear, setDpYear,
    dpMonth, setDpMonth,
    showAcctPickerSheet,
    acctPickerAnim,
    acctPickerSheetTarget,
    // Menu expansion state
    menuAccountsExpanded, setMenuAccountsExpanded,
    menuAccountsEditMode, setMenuAccountsEditMode,
    menuIncomeCatExpanded, setMenuIncomeCatExpanded,
    menuIncomeCatEditMode, setMenuIncomeCatEditMode,
    menuExpenseCatExpanded, setMenuExpenseCatExpanded,
    menuExpenseCatEditMode, setMenuExpenseCatEditMode,
    menuTagsExpanded, setMenuTagsExpanded,
    menuTagsEditMode, setMenuTagsEditMode,
    selectedTags,
    // Filter
    interval, setInterval,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    selectedTagFilter, setSelectedTagFilter,
    setSelectedAccountId,
    desktopView,
    // Refs
    catPickerAnim, isCatPickerOpen, dragHighlightedCatId,
    catCellRefs, catCellMeasurements, noteInputRef,
    isCatPickerOpenRef,
    // Actions
    saveEntry, deleteTransaction,
    saveCategory, deleteCategory, toggleCategoryHidden,
    saveAccount, deleteAccount,
    saveTag, deleteTag,
    createTag, toggleTag,
    openIconPickerSheet, closeIconPickerSheet,
    openCatPicker, closeCatPicker,
    openAcctPickerSheet, closeAcctPickerSheet,
    openDatePicker, openTransferDatePicker,
    appendNumpad, transferAppendNumpad,
    formatCurrency,
    loadManagedInvites,
    saveInviteToken, removeInviteToken, joinByToken,
    shareInvite,
    openEntryModal,
    openCreateAccount, openEditAccount,
    openCreateTag, openEditTag,
    openInvitationsModal,
    moveAccount, setPrimary, toggleAccountExclusion,
    setShowOnlyTransfers,
    saveTransfer,
  } = useDashboard();

  return (
    <>
      <QuickNavigation
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        signOut={signOut}
        navigation={navigation}
        accounts={accounts}
        primaryAccountId={primaryAccountId}
        excludedAccountIds={excludedAccountIds}
        accountSettings={accountSettings}
        menuAccountsExpanded={menuAccountsExpanded}
        setMenuAccountsExpanded={setMenuAccountsExpanded}
        menuAccountsEditMode={menuAccountsEditMode}
        setMenuAccountsEditMode={setMenuAccountsEditMode}
        setSelectedAccountId={setSelectedAccountId}
        moveAccount={moveAccount}
        setPrimary={setPrimary}
        toggleAccountExclusion={toggleAccountExclusion}
        openCreateAccount={openCreateAccount}
        openEditAccount={openEditAccount}
        deleteAccount={deleteAccount}
        categories={categories}
        selectedCategories={categories.filter((c) => !hiddenCategoryIds.has(c.id))}
        hiddenCategoryIds={hiddenCategoryIds}
        menuIncomeCatExpanded={menuIncomeCatExpanded}
        setMenuIncomeCatExpanded={setMenuIncomeCatExpanded}
        menuIncomeCatEditMode={menuIncomeCatEditMode}
        setMenuIncomeCatEditMode={setMenuIncomeCatEditMode}
        menuExpenseCatExpanded={menuExpenseCatExpanded}
        setMenuExpenseCatExpanded={setMenuExpenseCatExpanded}
        menuExpenseCatEditMode={menuExpenseCatEditMode}
        setMenuExpenseCatEditMode={setMenuExpenseCatEditMode}
        openEntryModal={openEntryModal}
        toggleCategoryHidden={toggleCategoryHidden}
        setEditingCategoryId={setEditingCategoryId}
        setCategoryName={setCategoryName}
        setCategoryType={setCategoryType}
        setCategoryColor={setCategoryColor}
        setCategoryIcon={setCategoryIcon}
        setCategoryTagIds={setCategoryTagIds}
        setShowCategoryModal={setShowCategoryModal}
        deleteCategory={deleteCategory}
        selectedTags={selectedTags}
        menuTagsExpanded={menuTagsExpanded}
        setMenuTagsExpanded={setMenuTagsExpanded}
        menuTagsEditMode={menuTagsEditMode}
        setMenuTagsEditMode={setMenuTagsEditMode}
        openCreateTag={openCreateTag}
        openEditTag={openEditTag}
        deleteTag={deleteTag}
        interval={interval}
        setInterval={setInterval}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        pendingDebtCount={pendingDebtCount}
        setShowFriendsModal={setShowFriendsModal}
        openInvitationsModal={openInvitationsModal}
        reloadDashboard={reloadDashboard}
        onFilterTransfers={() => { setMenuOpen(false); setShowOnlyTransfers(true); }}
        selectedTagFilter={selectedTagFilter}
        onFilterTag={(id) => { setSelectedTagFilter((prev) => (prev === id ? null : id)); }}
      />

      <EntryModal
        visible={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        editingTransactionId={editingTransactionId}
        entryType={entryType}
        setEntryType={setEntryType}
        entryAmount={entryAmount}
        setEntryAmount={setEntryAmount}
        entryDate={entryDate}
        entryNote={entryNote}
        setEntryNote={setEntryNote}
        entryCategoryId={entryCategoryId}
        setEntryCategoryId={setEntryCategoryId}
        entryTagIds={entryTagIds}
        toggleTag={toggleTag}
        noteFieldFocused={noteFieldFocused}
        setNoteFieldFocused={setNoteFieldFocused}
        accounts={accounts}
        entryAccountId={entryAccountId}
        setEntryAccountId={setEntryAccountId}
        entryAccount={entryAccount}
        selectedCurrency={selectedCurrency}
        entryCategories={entryCategories}
        entryTags={entryTags}
        entryTagUsage={entryTagUsage}
        recentCategoryAmounts={recentCategoryAmounts}
        noteSuggestions={noteSuggestions}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        createTag={createTag}
        appendNumpad={appendNumpad}
        saveEntry={saveEntry}
        formatCurrency={formatCurrency}
        openDatePicker={openDatePicker}
        openAcctPickerSheet={openAcctPickerSheet}
        catPickerAnim={catPickerAnim}
        isCatPickerOpen={isCatPickerOpen}
        dragHighlightedCatId={dragHighlightedCatId}
        openCatPicker={openCatPicker}
        closeCatPicker={closeCatPicker}
        catCellRefs={catCellRefs}
        catCellMeasurements={catCellMeasurements}
        height={height}
        noteInputRef={noteInputRef}
        saving={saving}
        onDelete={editingTransactionId ? () => void deleteTransaction(editingTransactionId) : undefined}
      />

      <CategoryModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        editingCategoryId={editingCategoryId}
        categoryName={categoryName}
        setCategoryName={setCategoryName}
        categoryType={categoryType}
        setCategoryType={setCategoryType}
        categoryColor={categoryColor}
        setCategoryColor={setCategoryColor}
        categoryIcon={categoryIcon}
        setCategoryIcon={setCategoryIcon}
        categoryTagIds={categoryTagIds}
        setCategoryTagIds={setCategoryTagIds}
        tags={tags}
        onSave={() => void saveCategory()}
        onDelete={deleteCategory}
        onToggleHidden={(catId) => { void toggleCategoryHidden(catId); setShowCategoryModal(false); }}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
        isOwnedByUser={!editingCategoryId || categories.find((c) => c.id === editingCategoryId)?.user_id === user?.id}
        isHidden={editingCategoryId ? hiddenCategoryIds.has(editingCategoryId) : false}
      />

      <AccountModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        editingAccountId={editingAccountId}
        editingAccount={editingAccount}
        user={user}
        newAccountName={newAccountName}
        setNewAccountName={setNewAccountName}
        newAccountIcon={newAccountIcon}
        setNewAccountIcon={setNewAccountIcon}
        newAccountCurrency={newAccountCurrency}
        setNewAccountCurrency={setNewAccountCurrency}
        settingsIncluded={settingsIncluded}
        setSettingsIncluded={setSettingsIncluded}
        settingsCarryOver={settingsCarryOver}
        setSettingsCarryOver={setSettingsCarryOver}
        settingsInitialBalance={settingsInitialBalance}
        setSettingsInitialBalance={setSettingsInitialBalance}
        settingsInitialDate={settingsInitialDate}
        setSettingsInitialDate={setSettingsInitialDate}
        accountTagIds={accountTagIds}
        setAccountTagIds={setAccountTagIds}
        tags={tags}
        onSave={() => void saveAccount()}
        onDelete={deleteAccount}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
      />

      <TagModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        editingTagId={editingTagId}
        tagName={tagName}
        setTagName={setTagName}
        tagColor={tagColor}
        setTagColor={setTagColor}
        tagIcon={tagIcon}
        setTagIcon={setTagIcon}
        onSave={() => void saveTag()}
        onDelete={deleteTag}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
      />

      <TransferModal
        visible={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        desktopView={desktopView}
        accounts={accounts}
        transferFromId={transferFromId}
        transferToId={transferToId}
        transferSourceAmount={transferSourceAmount}
        transferRate={transferRate}
        setTransferRate={setTransferRate}
        transferTargetAmount={transferTargetAmount}
        setTransferTargetAmount={setTransferTargetAmount}
        transferDate={transferDate}
        transferNote={transferNote}
        setTransferNote={setTransferNote}
        onSave={() => void saveTransfer()}
        saving={saving}
        appendNumpad={transferAppendNumpad}
        openDatePicker={openTransferDatePicker}
        openAcctPickerSheet={openAcctPickerSheet}
        formatCurrency={formatCurrency}
      />

      <InvitationsModal
        visible={showInvitationsModal}
        onClose={() => setShowInvitationsModal(false)}
        desktopView={desktopView}
        accounts={accounts}
        invitationAccountId={invitationAccountId}
        setInvitationAccountId={setInvitationAccountId}
        loadManagedInvites={loadManagedInvites}
        openAcctPickerSheet={openAcctPickerSheet}
        inviteName={inviteName}
        setInviteName={setInviteName}
        inviteExpiresDays={inviteExpiresDays}
        setInviteExpiresDays={setInviteExpiresDays}
        editingInviteId={editingInviteId}
        setEditingInviteId={setEditingInviteId}
        managedInvites={managedInvites}
        joinToken={joinToken}
        setJoinToken={setJoinToken}
        saveInviteToken={saveInviteToken}
        removeInviteToken={removeInviteToken}
        joinByToken={joinByToken}
        shareInvite={shareInvite}
        saving={saving}
      />

      <FriendsModal
        visible={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        friends={friends}
        pendingRequests={pendingRequests}
        loading={friendsLoading}
        onOpen={loadFriends}
        sendRequest={friendSendRequest}
        acceptRequest={friendAcceptRequest}
        rejectRequest={friendRejectRequest}
        cancelRequest={friendCancelRequest}
        removeFriend={removeFriend}
        blockUser={blockUser}
        ownedAccounts={accounts.filter((a) => a.created_by === user?.id)}
        friendAccountMap={friendAccountMap}
        addFriendToAccount={addFriendToAccount}
        removeFriendFromAccount={removeFriendFromAccount}
        reloadDashboard={reloadDashboard}
      />

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        entryDate={datePickerTarget === 'transfer' ? transferDate : entryDate}
        setEntryDate={datePickerTarget === 'transfer' ? setTransferDate : setEntryDate}
        dpYear={dpYear}
        setDpYear={setDpYear}
        dpMonth={dpMonth}
        setDpMonth={setDpMonth}
      />

      <AccountPickerSheet
        visible={showAcctPickerSheet}
        onClose={closeAcctPickerSheet}
        acctPickerAnim={acctPickerAnim}
        height={height}
        accounts={accounts}
        acctPickerSheetTarget={acctPickerSheetTarget}
        entryAccountId={entryAccountId}
        setEntryAccountId={setEntryAccountId}
        invitationAccountId={invitationAccountId}
        setInvitationAccountId={setInvitationAccountId}
        loadManagedInvites={loadManagedInvites}
        transferFromId={transferFromId}
        setTransferFromId={setTransferFromId}
        transferToId={transferToId}
        setTransferToId={setTransferToId}
      />

      <IconPickerSheet
        visible={showIconPickerSheet}
        onClose={closeIconPickerSheet}
        iconPickerAnim={iconPickerAnim}
        height={height}
        iconSearchQuery={iconSearchQuery}
        setIconSearchQuery={setIconSearchQuery}
        filteredIconNames={filteredIconNames}
        iconPickerTarget={iconPickerTarget}
        categoryIcon={categoryIcon}
        setCategoryIcon={setCategoryIcon}
        newAccountIcon={newAccountIcon}
        setNewAccountIcon={setNewAccountIcon}
        tagIcon={tagIcon}
        setTagIcon={setTagIcon}
      />
    </>
  );
}
