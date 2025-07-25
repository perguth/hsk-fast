// app.js
class HSKLearningApp {
    constructor() {
      this.vocabulary = null
      this.currentLevel = 'all'
      this.currentCard = null
      this.sessionStats = this.loadSessionStats()
      this.cardStates = this.loadCardStates()
      this.levelWords = []
      this.currentIndex = 0
      
      this.initializeElements()
      this.bindEvents()
      this.loadVocabulary()
    }
  
    initializeElements() {
      this.elements = {
        loading: document.getElementById('loading'),
        app: document.getElementById('app'),
        levelSelect: document.getElementById('hsk-level'),
        resetBtn: document.getElementById('reset-progress'),
        flashcard: document.getElementById('flashcard'),
        cardFront: document.querySelector('.card-front'),
        cardBack: document.querySelector('.card-back'),
        chineseText: document.getElementById('chinese-text'),
        pinyinText: document.getElementById('pinyin-text'),
        meaningText: document.getElementById('meaning-text'),
        posText: document.getElementById('pos-text'),
        frequencyText: document.getElementById('frequency-text'),
        showAnswerBtn: document.getElementById('show-answer'),
        unknownBtn: document.getElementById('unknown-btn'),
        knownBtn: document.getElementById('known-btn'),
        levelDisplay: document.getElementById('level-display'),
        progress: document.getElementById('progress'),
        accuracy: document.getElementById('accuracy'),
        newCards: document.getElementById('new-cards'),
        reviewCards: document.getElementById('review-cards'),
        learnedCards: document.getElementById('learned-cards')
      }
    }
  
    bindEvents() {
      this.elements.levelSelect.addEventListener('change', (e) => {
        const value = e.target.value
        this.changeLevel(value === 'all' ? 'all' : parseInt(value))
      })
  
      this.elements.resetBtn.addEventListener('click', () => {
        this.resetProgress()
      })
  
      this.elements.showAnswerBtn.addEventListener('click', () => {
        this.showAnswer()
      })
  
      this.elements.unknownBtn.addEventListener('click', () => {
        this.answerCard(false) // Unknown = false
      })
  
      this.elements.knownBtn.addEventListener('click', () => {
        this.answerCard(true) // Known = true
      })
  
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.hideAnswer()
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (!this.elements.cardBack.classList.contains('hidden')) {
            return
          }
          e.preventDefault()
          this.showAnswer()
        } else if (!this.elements.cardBack.classList.contains('hidden')) {
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault()
              this.answerCard(false) // Unknown
              break
            case 'ArrowRight':
              e.preventDefault()
              this.answerCard(true) // Known
              break
          }
        }
      })
    }
  
    async loadVocabulary() {
      try {
        const response = await fetch('complete-hsk-vocabulary/complete.min.json')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        this.vocabulary = await response.json()
        this.filterWordsForLevel()
        this.elements.loading.classList.add('hidden')
        this.elements.app.classList.remove('hidden')
        this.nextCard()
      } catch (error) {
        console.error('Error loading vocabulary:', error)
        this.elements.loading.innerHTML = `
          <div class="error">
            <p>Error loading vocabulary</p>
            <button onclick="location.reload()" class="btn btn-primary">Reload</button>
          </div>
        `
      }
    }
  
    filterWordsForLevel() {
      if (!this.vocabulary) return
  
      if (this.currentLevel === 'all') {
        // Include all words from HSK 1-6
        this.levelWords = this.vocabulary.filter(word => {
          const levels = word.l || []
          return levels.some(level => {
            const levelStr = String(level)
            const levelNum = parseInt(levelStr.replace(/\D/g, ''))
            return levelNum >= 1 && levelNum <= 6
          })
        })
      } else {
        // Filter for specific level
        this.levelWords = this.vocabulary.filter(word => {
          const levels = word.l || []
          return levels.some(level => {
            const levelStr = String(level)
            const levelNum = parseInt(levelStr.replace(/\D/g, ''))
            return levelNum === this.currentLevel
          })
        })
      }
  
      this.currentIndex = 0
      this.updateStats()
    }
  
    getCardState(wordId) {
      const key = `${this.currentLevel}-${wordId}`
      return this.cardStates[key] || {
        correctCount: 0,
        incorrectCount: 0,
        totalSeen: 0,
        consecutiveCorrect: 0,
        isNew: true,
        isLearned: false,
        priority: 1.0 // Higher = more likely to appear
      }
    }
  
    setCardState(wordId, state) {
      const key = `${this.currentLevel}-${wordId}`
      this.cardStates[key] = state
      this.saveCardStates()
    }
  
    loadCardStates() {
      try {
        const saved = localStorage.getItem('hsk-card-states')
        return saved ? JSON.parse(saved) : {}
      } catch {
        return {}
      }
    }
  
    saveCardStates() {
      try {
        localStorage.setItem('hsk-card-states', JSON.stringify(this.cardStates))
      } catch (error) {
        console.error('Error saving card states:', error)
      }
    }
  
    loadSessionStats() {
      try {
        const saved = localStorage.getItem('hsk-session-stats')
        return saved ? JSON.parse(saved) : {
          newCards: 0,
          reviewCards: 0,
          learnedCards: 0,
          totalAnswered: 0,
          correctAnswers: 0
        }
      } catch {
        return {
          newCards: 0,
          reviewCards: 0,
          learnedCards: 0,
          totalAnswered: 0,
          correctAnswers: 0
        }
      }
    }
  
    saveSessionStats() {
      try {
        localStorage.setItem('hsk-session-stats', JSON.stringify(this.sessionStats))
      } catch (error) {
        console.error('Error saving session stats:', error)
      }
    }
  
    updateCardStatistics(currentState, isKnown) {
      const state = { ...currentState }
      
      state.totalSeen++
      state.isNew = false
      
      if (isKnown) {
        state.correctCount++
        state.consecutiveCorrect++
        
        // Reduce priority as card becomes better known
        const accuracy = state.correctCount / state.totalSeen
        if (accuracy >= 0.8 && state.consecutiveCorrect >= 3) {
          state.isLearned = true
          state.priority = Math.max(0.1, state.priority * 0.5) // Dramatically reduce priority
        } else if (accuracy >= 0.6) {
          state.priority = Math.max(0.3, state.priority * 0.7) // Reduce priority
        } else {
          state.priority = Math.min(2.0, state.priority * 1.1) // Slightly increase priority
        }
      } else {
        state.incorrectCount++
        state.consecutiveCorrect = 0
        state.isLearned = false
        
        // Increase priority for difficult cards
        const accuracy = state.correctCount / state.totalSeen
        if (accuracy < 0.3) {
          state.priority = Math.min(3.0, state.priority * 1.5) // High priority for very difficult cards
        } else if (accuracy < 0.6) {
          state.priority = Math.min(2.5, state.priority * 1.3) // Medium-high priority
        } else {
          state.priority = Math.min(2.0, state.priority * 1.2) // Moderate increase
        }
      }
      
      return state
    }
  
    selectNextCard() {
      if (!this.levelWords.length) return null
  
      // Create weighted list based on priorities
      const cardWeights = this.levelWords.map(word => {
        const state = this.getCardState(this.getWordId(word))
        return {
          word,
          weight: state.priority,
          state
        }
      })
  
      // Prioritize new cards and high-priority cards
      cardWeights.sort((a, b) => {
        // New cards get highest priority
        if (a.state.isNew && !b.state.isNew) return -1
        if (!a.state.isNew && b.state.isNew) return 1
        
        // Then sort by priority weight
        return b.weight - a.weight
      })
  
      // Use weighted random selection from top candidates
      const topCandidates = cardWeights.slice(0, Math.min(10, cardWeights.length))
      const totalWeight = topCandidates.reduce((sum, item) => sum + item.weight, 0)
      
      if (totalWeight === 0) {
        return topCandidates[0]?.word || this.levelWords[0]
      }
  
      let random = Math.random() * totalWeight
      for (const candidate of topCandidates) {
        random -= candidate.weight
        if (random <= 0) {
          return candidate.word
        }
      }
  
      return topCandidates[0]?.word || this.levelWords[0]
    }
  
    getWordId(word) {
      return word.s || 'unknown'
    }
  
    nextCard() {
      this.currentCard = this.selectNextCard()
      if (!this.currentCard) return
  
      this.displayCard()
      this.hideAnswer()
      this.updateStats()
    }
  
    displayCard() {
      if (!this.currentCard) return
  
      const simplified = this.currentCard.s || ''
      
      // Extract pinyin from the first form
      let pinyin = ''
      if (this.currentCard.f && this.currentCard.f.length > 0) {
        const firstForm = this.currentCard.f[0]
        pinyin = firstForm.i?.y || ''
      }
      
      // Extract meanings from the first form
      let meanings = []
      if (this.currentCard.f && this.currentCard.f.length > 0) {
        const firstForm = this.currentCard.f[0]
        meanings = firstForm.m || []
      }
      
      const pos = this.currentCard.p || []
      const frequency = this.currentCard.q || ''
  
      this.elements.chineseText.textContent = simplified
      this.elements.pinyinText.textContent = pinyin
      
      // Display meanings
      let meaningText = 'No meaning available'
      if (meanings.length > 0) {
        meaningText = meanings.slice(0, 3).join('; ')
      }
      
      this.elements.meaningText.textContent = meaningText
      this.elements.posText.textContent = Array.isArray(pos) ? pos.join(', ') : pos
      this.elements.frequencyText.textContent = frequency ? `Frequency: ${frequency}` : ''
    }
  
    showAnswer() {
      this.elements.cardFront.classList.add('hidden')
      this.elements.cardBack.classList.remove('hidden')
    }
  
    hideAnswer() {
      this.elements.cardFront.classList.remove('hidden')
      this.elements.cardBack.classList.add('hidden')
    }
  
    answerCard(isKnown) {
      if (!this.currentCard) return
  
      const wordId = this.getWordId(this.currentCard)
      const currentState = this.getCardState(wordId)
      const newState = this.updateCardStatistics(currentState, isKnown)
      
      this.setCardState(wordId, newState)
      
      // Update session stats
      this.sessionStats.totalAnswered++
      if (isKnown) {
        this.sessionStats.correctAnswers++
      }
      
      if (currentState.isNew) {
        this.sessionStats.newCards++
      } else {
        this.sessionStats.reviewCards++
      }
      
      if (newState.isLearned && !currentState.isLearned) {
        this.sessionStats.learnedCards++
      }
  
      // Save session stats after each answer
      this.saveSessionStats()
  
      this.nextCard()
    }
  
    updateStats() {
      if (!this.levelWords.length) return
  
      const learned = this.levelWords.filter(word => {
        const state = this.getCardState(this.getWordId(word))
        return state.isLearned
      }).length
  
      const accuracy = this.sessionStats.totalAnswered > 0 ? 
        Math.round((this.sessionStats.correctAnswers / this.sessionStats.totalAnswered) * 100) : 0
  
      const levelText = this.currentLevel === 'all' ? 'HSK All' : `HSK ${this.currentLevel}`
      this.elements.levelDisplay.textContent = levelText
      this.elements.progress.textContent = `${learned}/${this.levelWords.length}`
      this.elements.accuracy.textContent = `${accuracy}%`
      this.elements.newCards.textContent = this.sessionStats.newCards
      this.elements.reviewCards.textContent = this.sessionStats.reviewCards
      this.elements.learnedCards.textContent = this.sessionStats.learnedCards
    }
  
    changeLevel(newLevel) {
      this.currentLevel = newLevel
      this.filterWordsForLevel()
      this.nextCard()
    }
  
    resetProgress() {
      if (confirm('Are you sure you want to reset all progress?')) {
        // Clear all stored data
        this.cardStates = {}
        this.sessionStats = {
          newCards: 0,
          reviewCards: 0,
          learnedCards: 0,
          totalAnswered: 0,
          correctAnswers: 0
        }
        
        // Save the reset state
        this.saveCardStates()
        this.saveSessionStats()
        
        this.filterWordsForLevel()
        this.nextCard()
      }
    }
  }
  
  // Initialize app when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    new HSKLearningApp()
  })