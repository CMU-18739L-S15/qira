#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        printf("Wrong args!\n");
        exit(1);
    }
    int input = atoi(argv[1]);

    if (((input ^ 0xFAFAFAFA) + 0x5123) == 0xABCD)
        printf("Win!\n");
    else
        printf("Lose!\n");
    return 0;
}
