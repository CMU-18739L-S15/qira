#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main() {
  char data[16];
  fgets(data, 16, stdin);
  size_t len = strlen(data);
  data[len-1] = '\0';
  if (strlen(data) != 8) {
    //printf("Sorry, %s is not the right string!\n", data);
    return 0;
  }

  // Okay, let's just pretend they were numbers.
  unsigned int *idata = (unsigned int *)(&data);
  if ((idata[0] + idata[1]) != 0xd5d3dddc) return 0;
  if ((idata[0] ^ idata[1]) != 0xfe3301ab) return 0;
  /*if (idata[1] + idata[2] != 0xc0dcdfce) return 0;
  if (idata[0] * 3 + idata[1] * 5 != 0x404a7666) return 0;
  if ((idata[0] ^ idata[3]) != 0x18030607) return 0;
  if ((idata[0] & idata[3]) != 0x666c6970) return 0;
  if (idata[1] * idata[4] != 0xb180902b) return 0;
  if (idata[2] * idata[4] != 0x3e436b5f) return 0;
  if (idata[4] + idata[5] * 2 != 0x5c483831) return 0;
  if ((idata[5] & 0x70000000) != 0x70000000) return 0;
  if (idata[5] / idata[6] != 1) return 0;
  if (idata[5] % idata[6] != 0xe000cec) return 0;
  if (idata[7] * 2 + idata[4] * 3 != 0x3726eb17) return 0;
  if (idata[7] * 7 + idata[2] * 4 != 0x8b0b922d) return 0;
  if (idata[7] * 3 + idata[3] != 0xb9cf9c91) return 0;*/
  return 1;
}
