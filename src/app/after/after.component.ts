import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { HubConnection } from '@microsoft/signalr';
import { time } from 'console';
import { last } from 'rxjs';
import { ConnectionService } from '../connection.service';
import { Chapter, GameState, Player, Room, Tale } from '../types/entities';

@Component({
  selector: 'app-after',
  templateUrl: './after.component.html',
  styleUrls: ['./after.component.sass']
})
export class AfterComponent implements OnInit {
  hub: HubConnection;
  @Input() room: Room;
  @Input() tales: Tale[];
  @Input() players: Player[];
  @Input() player: Player;
  @Input() gameState: GameState;
  @Output() changeGameState = new EventEmitter<GameState>();

  playingTale: Tale;
  taleNumber: number = 0;
  lastShownChapter: number = 0;
  showingChapters: Chapter[] = [];

  votedSkip: boolean = false;
  readingEnded: boolean = false;

  gameEnded: boolean = false;


  readonly SECONDS_PER_CHAPTER: number = 15;
  nextTimer: {id: number, counter: number, isRunning: boolean} =
  {id: 0, counter: 0, isRunning: false}

  getAuthorName(authorId: number): string {
    return this.players.find(p => p.id === authorId)!.name;
  }

  async elapse() {
    this.nextTimer.counter++;
    let readingTime = this.SECONDS_PER_CHAPTER * this.playingTale.chapters.length;
    console.log(`Remaining ${readingTime-this.nextTimer.counter} of reading`);
    // Calculate which chapters to show based on time
    let chapterIndex = Math.floor(this.nextTimer.counter/this.SECONDS_PER_CHAPTER);

    if (chapterIndex > this.lastShownChapter && chapterIndex !== this.playingTale.chapters.length)
    {
      console.log(`Chapter index : ${chapterIndex}`);
      this.lastShownChapter = chapterIndex;
      this.showingChapters = this.playingTale.chapters.slice(undefined, this.lastShownChapter + 1);
      console.log(this.showingChapters, `Showing chapters to ${this.lastShownChapter}`);
      this.cdref.detectChanges();
    }

    if (this.nextTimer.counter >= readingTime) {
      clearInterval(this.nextTimer.id);
      this.nextTimer.isRunning = false;
      this.readingEnded = true;
      console.log('Loading next tale to read.');
      if (!this.votedSkip) await this.toggleSkip();
    }
  }

  constructor(private connection: ConnectionService, private cdref: ChangeDetectorRef) {
    this.hub = connection.instance;
  }

  ngOnInit(): void {
    console.log(this.players, 'Players on After');

    console.log('Reading stories begin.');
    this.playingTale = this.tales[this.taleNumber];
    console.log(this.playingTale, 'Current reading tale.');
    this.showingChapters.push(this.playingTale.chapters[0]);
    this.lastShownChapter = 0;

    this.startInterval();

    this.hub.on('everyoneVoted', () => this.nextTale());
  }

  async toggleSkip() {
    this.votedSkip = !this.votedSkip;
    await this.hub.invoke('SkipVotesChanged', this.room.id, this.votedSkip);
  }

  startInterval() {
    this.nextTimer.id = window.setInterval(async () => this.elapse(), 1000);

    console.log(`Chapter index : 0`);
    this.nextTimer.isRunning = true;
  }

  nextTale() {
    this.taleNumber++;
    if (this.taleNumber > this.tales.length - 1) {
      console.log('Game ended, navigating end room');
      this.changeGameState.emit(GameState.GAME_ENDED);
      return;
    }
    console.log('Loading next tale...');
    if (this.nextTimer.isRunning) clearInterval(this.nextTimer.id);
    this.nextTimer.counter = 0;
    this.playingTale = this.tales[this.taleNumber];

    console.log(this.playingTale, 'Current reading tale.');
    this.showingChapters = [this.playingTale.chapters[0]];
    this.lastShownChapter = 0;

    console.log(this.playingTale, 'Current reading tale.');
    this.readingEnded = false;
    this.votedSkip = false;
    this.startInterval();
    console.log('Next tale loaded.');
    this.cdref.detectChanges();
  }

}
