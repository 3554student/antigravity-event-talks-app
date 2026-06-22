document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let selectedNoteId = null;
    let activeTypeFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const notesGrid = document.getElementById('notes-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const lastUpdatedSpan = document.getElementById('last-updated');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeSun = document.getElementById('theme-sun');
    const themeMoon = document.getElementById('theme-moon');
    
    // Type Filter Tabs
    const tabButtons = document.querySelectorAll('#type-tabs .tab-btn');
    const countAll = document.getElementById('count-all');
    const countFeature = document.getElementById('count-feature');
    const countAnnouncement = document.getElementById('count-announcement');
    const countIssue = document.getElementById('count-issue');
    const countDeprecation = document.getElementById('count-deprecation');

    // Tweet Drawer Elements
    const tweetDrawer = document.getElementById('tweet-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const progressCircle = document.getElementById('char-progress-circle');
    const cancelTweetBtn = document.getElementById('btn-cancel-tweet');
    const sendTweetBtn = document.getElementById('btn-send-tweet');

    // Initialize Lucide icons
    lucide.createIcons();

    // Theme Management
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcons(savedTheme);
    };

    const updateThemeIcons = (theme) => {
        if (theme === 'dark') {
            themeSun.style.display = 'block';
            themeMoon.style.display = 'none';
        } else {
            themeSun.style.display = 'none';
            themeMoon.style.display = 'block';
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcons(newTheme);
    });

    initTheme();

    // Fetch Release Notes
    const fetchReleaseNotes = async (forceRefresh = false) => {
        setLoadingState(true);
        try {
            const url = `/api/release-notes${forceRefresh ? '?force_refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                releaseNotes = data.notes;
                lastUpdatedSpan.textContent = `Updated: ${data.fetched_at}`;
                updateCounts();
                renderCards();
            } else {
                console.error("Failed to load release notes:", data.error);
                showEmptyState(true);
            }
        } catch (error) {
            console.error("Error fetching release notes:", error);
            showEmptyState(true);
        } finally {
            setLoadingState(false);
        }
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            loader.style.display = 'flex';
            notesGrid.style.display = 'none';
            emptyState.style.display = 'none';
            refreshIcon.classList.add('icon-spin');
            refreshBtn.disabled = true;
        } else {
            loader.style.display = 'none';
            refreshIcon.classList.remove('icon-spin');
            refreshBtn.disabled = false;
        }
    };

    // Calculate Tweet Character count (treating any URL as 23 characters)
    const calculateTwitterLength = (text) => {
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = text.match(urlRegex) || [];
        
        // Remove URLs from text to count remaining characters
        let textWithoutUrls = text;
        urls.forEach(url => {
            textWithoutUrls = textWithoutUrls.replace(url, '');
        });
        
        // 23 characters per URL in Twitter
        return textWithoutUrls.length + (urls.length * 23);
    };

    // Update character progress ring & text limit warning
    const updateCharCounter = () => {
        const text = tweetTextarea.value;
        const twitterLen = calculateTwitterLength(text);
        const remaining = 280 - twitterLen;
        
        charCounter.textContent = remaining;
        
        // Circular progress calculation
        const radius = progressCircle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        
        const percentage = Math.min(twitterLen / 280, 1);
        const offset = circumference - (percentage * circumference);
        progressCircle.style.strokeDashoffset = offset;
        
        // Color warnings based on characters left
        charCounter.className = 'char-counter';
        if (remaining <= 20 && remaining >= 0) {
            charCounter.classList.add('warning');
            progressCircle.style.stroke = '#f59e0b';
        } else if (remaining < 0) {
            charCounter.classList.add('danger');
            progressCircle.style.stroke = '#ef4444';
            sendTweetBtn.disabled = true;
        } else {
            progressCircle.style.stroke = '#3b82f6';
            sendTweetBtn.disabled = false;
        }
    };

    tweetTextarea.addEventListener('input', updateCharCounter);

    // Generate Pre-composed Tweet Text
    const composeTweet = (note) => {
        const prefix = `BigQuery ${note.type} (${note.date}): `;
        const link = note.link;
        
        // Base lengths: prefix + space + 23 characters for short t.co link
        const baseLength = prefix.length + 1 + 23;
        const maxDescriptionLength = 280 - baseLength;
        
        let desc = note.text;
        if (desc.length > maxDescriptionLength) {
            desc = desc.substring(0, maxDescriptionLength - 3) + '...';
        }
        
        return `${prefix}${desc} ${link}`;
    };

    // Open/Close Tweet Drawer
    const selectNote = (noteId) => {
        // Deselect previous
        if (selectedNoteId) {
            const prevCard = document.querySelector(`.release-card[data-id="${selectedNoteId}"]`);
            if (prevCard) prevCard.classList.remove('selected');
        }

        if (selectedNoteId === noteId) {
            // Toggle off
            selectedNoteId = null;
            tweetDrawer.classList.remove('open');
        } else {
            // Toggle on
            selectedNoteId = noteId;
            const card = document.querySelector(`.release-card[data-id="${noteId}"]`);
            if (card) card.classList.add('selected');
            
            const note = releaseNotes.find(n => n.id === noteId);
            if (note) {
                tweetTextarea.value = composeTweet(note);
                updateCharCounter();
                tweetDrawer.classList.add('open');
            }
        }
    };

    const deselectAllNotes = () => {
        if (selectedNoteId) {
            const card = document.querySelector(`.release-card[data-id="${selectedNoteId}"]`);
            if (card) card.classList.remove('selected');
        }
        selectedNoteId = null;
        tweetDrawer.classList.remove('open');
    };

    closeDrawerBtn.addEventListener('click', deselectAllNotes);
    cancelTweetBtn.addEventListener('click', deselectAllNotes);

    // Send/Post Tweet
    sendTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const twitterLen = calculateTwitterLength(text);
        
        if (twitterLen <= 280) {
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(shareUrl, '_blank');
        }
    });

    // Update Counts on Badges
    const updateCounts = () => {
        const counts = {
            all: 0,
            feature: 0,
            announcement: 0,
            issue: 0,
            deprecation: 0
        };

        releaseNotes.forEach(note => {
            counts.all++;
            const typeKey = note.type.toLowerCase();
            if (counts.hasOwnProperty(typeKey)) {
                counts[typeKey]++;
            }
        });

        countAll.textContent = counts.all;
        countFeature.textContent = counts.feature;
        countAnnouncement.textContent = counts.announcement;
        countIssue.textContent = counts.issue;
        countDeprecation.textContent = counts.deprecation;
    };

    // Filter and Search notes
    const getFilteredNotes = () => {
        return releaseNotes.filter(note => {
            const matchesType = activeTypeFilter === 'all' || note.type.toLowerCase() === activeTypeFilter;
            
            const textToSearch = `${note.type} ${note.date} ${note.text} ${note.html}`.toLowerCase();
            const matchesSearch = textToSearch.includes(searchQuery.toLowerCase());
            
            return matchesType && matchesSearch;
        });
    };

    // Render Cards in Grid
    const renderCards = () => {
        const filtered = getFilteredNotes();
        
        if (filtered.length === 0) {
            showEmptyState(true);
            notesGrid.style.display = 'none';
            return;
        }

        showEmptyState(false);
        notesGrid.innerHTML = '';
        
        filtered.forEach(note => {
            const typeClass = `type-${note.type.toLowerCase()}`;
            const isSelected = selectedNoteId === note.id ? 'selected' : '';
            
            const card = document.createElement('div');
            card.className = `release-card ${typeClass} ${isSelected}`;
            card.setAttribute('data-id', note.id);
            
            card.innerHTML = `
                <div class="card-top">
                    <span class="card-badge">${note.type}</span>
                    <div class="card-meta-date">
                        <i data-lucide="calendar"></i>
                        <span>${note.date}</span>
                    </div>
                </div>
                <div class="card-content">
                    ${note.html}
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-icon btn-tweet-card" title="Tweet this update">
                        <i data-lucide="twitter"></i>
                        <span>Tweet</span>
                    </button>
                    <div class="selection-check">
                        <i data-lucide="check" style="display: none;"></i>
                    </div>
                </div>
            `;
            
            // Event listener to click card
            card.addEventListener('click', (e) => {
                // Ignore clicks on links in content
                if (e.target.tagName === 'A') return;
                
                // If it is the tweet button or inside it
                const tweetBtn = e.target.closest('.btn-tweet-card');
                if (tweetBtn) {
                    e.stopPropagation();
                    selectNote(note.id);
                    // Scroll to tweet composer
                    tweetDrawer.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                
                selectNote(note.id);
            });
            
            notesGrid.appendChild(card);
        });

        // Toggle visibility of checkmarks based on selected state
        document.querySelectorAll('.release-card').forEach(card => {
            const checkIcon = card.querySelector('.selection-check i');
            if (checkIcon) {
                if (card.classList.contains('selected')) {
                    checkIcon.style.display = 'block';
                } else {
                    checkIcon.style.display = 'none';
                }
            }
        });

        notesGrid.style.display = 'grid';
        setTimeout(() => {
            notesGrid.classList.add('visible');
        }, 50);
        
        // Re-initialize icons inside card elements
        lucide.createIcons();
    };

    const showEmptyState = (show) => {
        emptyState.style.display = show ? 'flex' : 'none';
        if (show) {
            notesGrid.style.display = 'none';
        }
    };

    // Filter Buttons Listeners
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTypeFilter = btn.getAttribute('data-type');
            renderCards();
        });
    });

    // Search Input Listener
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        if (searchQuery) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        renderCards();
    });

    // Clear Search Input
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderCards();
    });

    // Reset Filters Listener
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        activeTypeFilter = 'all';
        tabButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('#type-tabs [data-type="all"]').classList.add('active');
        deselectAllNotes();
        renderCards();
    });

    // Refresh Button Click
    refreshBtn.addEventListener('click', () => {
        deselectAllNotes();
        fetchReleaseNotes(true);
    });

    // Fetch initial notes on page load
    fetchReleaseNotes(false);
});
