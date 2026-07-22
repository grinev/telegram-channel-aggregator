export class Deduplicator {
  private recentKeys: string[] = [];
  private readonly capacity: number;

  constructor(capacity = 10, initialKeys: string[] = []) {
    this.capacity = capacity;
    this.recentKeys = initialKeys.slice(-capacity);
  }

  isDuplicate(key: string): boolean {
    return this.recentKeys.includes(key);
  }

  add(key: string): void {
    if (this.recentKeys.includes(key)) {
      return;
    }
    this.recentKeys.push(key);
    if (this.recentKeys.length > this.capacity) {
      this.recentKeys.shift();
    }
  }

  getKeys(): string[] {
    return [...this.recentKeys];
  }
}
